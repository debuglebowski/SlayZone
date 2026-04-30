import type { AgentEvent } from '../shared/agent-events'

/** Render-ready item produced by the reducer. Tool calls are pre-paired with results. */
export type TimelineItem =
  | { kind: 'user-text'; text: string; timestamp: number }
  | { kind: 'text'; role: 'assistant'; messageId: string; text: string; timestamp: number }
  | { kind: 'thinking'; messageId: string; text: string; hasSignature: boolean; timestamp: number }
  | { kind: 'tool'; invocation: ToolInvocation; timestamp: number }
  | { kind: 'session-start'; sessionId: string; model: string; cwd: string; tools: string[]; timestamp: number }
  | {
      kind: 'result'
      subtype: string
      isError: boolean
      durationMs: number
      totalCostUsd: number
      numTurns: number
      text: string | null
      /** Concatenated assistant-text from this turn, for the footer Copy button. */
      copyText: string | null
      timestamp: number
    }
  | { kind: 'api-retry'; attempt: number; maxRetries: number; delayMs: number; error: string; timestamp: number }
  | { kind: 'rate-limit'; status: string; timestamp: number }
  | { kind: 'sub-agent'; phase: 'started' | 'updated' | 'notification'; timestamp: number }
  | { kind: 'stderr'; text: string; timestamp: number }
  | { kind: 'unknown'; reason: string; timestamp: number }

export interface ToolInvocation {
  id: string
  name: string
  input: unknown
  status: 'pending' | 'done' | 'error'
  result?: { rawContent: unknown; structured: unknown; isError: boolean }
}

export interface OpenBlock {
  /**
   * Index into `timeline` where this block's item lives, or -1 if the item hasn't been
   * materialized yet. Text/thinking blocks defer insertion until first delta to avoid
   * rendering empty placeholders (which look like gaps).
   */
  timelineIndex: number
  blockType: 'text' | 'thinking' | 'tool_use'
  /** Only for tool_use — remembered so we can link a deferred item to `toolIndex`. */
  toolUseId?: string
  toolName?: string
  /** Only for tool_use — used to rebuild item when the atomic `tool-call` arrives later. */
  messageId?: string
  /** Accumulating partial_json for tool_use blocks. Parsed on stream-block-stop. */
  partialJson?: string
}

export interface ChatTimelineState {
  timeline: TimelineItem[]
  /** tool_use_id → index into `timeline` for paired mutation. */
  toolIndex: Map<string, number>
  /** True once first turn-init seen. Subsequent turn-inits are treated as turn boundaries (ignored in timeline). */
  sessionStarted: boolean
  sessionId: string | null
  model: string | null
  lastResult: Extract<TimelineItem, { kind: 'result' }> | null
  sessionEnded: boolean
  exitCode: number | null
  exitSignal: string | null
  /** Monotonic count of user messages sent since session start. Drives inFlight. */
  userMessagesSent: number
  /** Count of 'result' events received. */
  resultCount: number
  /** Message id currently streaming (between stream-message-start and stream-message-stop). */
  currentStreamMessageId: string | null
  /** blockIndex → OpenBlock for the currently streaming message. Cleared at message-stop. */
  openBlocks: Map<number, OpenBlock>
  /**
   * Message ids we've already processed via streaming.
   * Atomic `assistant-text` / `assistant-thinking` events for these are suppressed as redundant.
   */
  streamedMessageIds: Set<string>
}

export function initialState(): ChatTimelineState {
  return {
    timeline: [],
    toolIndex: new Map(),
    sessionStarted: false,
    sessionId: null,
    model: null,
    lastResult: null,
    sessionEnded: false,
    exitCode: null,
    exitSignal: null,
    userMessagesSent: 0,
    resultCount: 0,
    currentStreamMessageId: null,
    openBlocks: new Map(),
    streamedMessageIds: new Set(),
  }
}

export type Action =
  | { type: 'event'; event: AgentEvent }
  | { type: 'user-sent'; text: string }
  | { type: 'process-exit'; sessionId: string; code: number | null; signal: string | null }
  | { type: 'reset' }

export function reducer(state: ChatTimelineState, action: Action): ChatTimelineState {
  switch (action.type) {
    case 'reset':
      return initialState()
    case 'user-sent': {
      const item: TimelineItem = {
        kind: 'user-text',
        text: action.text,
        timestamp: Date.now(),
      }
      return {
        ...state,
        timeline: [...state.timeline, item],
        userMessagesSent: state.userMessagesSent + 1,
      }
    }
    case 'process-exit': {
      // Drop stale exits: if no session has emitted turn-init yet (sessionId=null)
      // OR the exit's sessionId belongs to a prior, already-replaced session, the
      // event is leakage from the kill+respawn race (e.g. reset). The current
      // session is still alive and will emit its own turn-init/exit.
      if (state.sessionId === null || state.sessionId !== action.sessionId) {
        return state
      }
      return {
        ...state,
        sessionEnded: true,
        exitCode: action.code,
        exitSignal: action.signal,
      }
    }
    case 'event':
      return applyEvent(state, action.event)
  }
}

function applyEvent(state: ChatTimelineState, event: AgentEvent): ChatTimelineState {
  const ts = Date.now()
  switch (event.kind) {
    case 'user-message': {
      const item: TimelineItem = {
        kind: 'user-text',
        text: event.text,
        timestamp: ts,
      }
      return {
        ...state,
        timeline: [...state.timeline, item],
        userMessagesSent: state.userMessagesSent + 1,
      }
    }
    case 'turn-init': {
      // Restart detection: session previously ended, OR sessionId changed (new process spawned).
      // Kill+create cycle (reset chat, /clear builtin) produces a fresh turn-init — clear timeline
      // and ended-state so the UI re-enables input.
      const isRestart =
        state.sessionStarted &&
        (state.sessionEnded || (state.sessionId !== null && state.sessionId !== event.sessionId))
      if (isRestart) {
        const item: TimelineItem = {
          kind: 'session-start',
          sessionId: event.sessionId,
          model: event.model,
          cwd: event.cwd,
          tools: event.tools,
          timestamp: ts,
        }
        return {
          ...initialState(),
          timeline: [item],
          sessionStarted: true,
          sessionId: event.sessionId,
          model: event.model,
        }
      }
      if (state.sessionStarted) {
        return { ...state, sessionId: event.sessionId, model: event.model }
      }
      const item: TimelineItem = {
        kind: 'session-start',
        sessionId: event.sessionId,
        model: event.model,
        cwd: event.cwd,
        tools: event.tools,
        timestamp: ts,
      }
      // Prepend session-start: user messages may arrive in the timeline before turn-init
      // (optimistic user-sent dispatch races the stream). Keep session-start at the top.
      // Also clear any stale end-state: a fresh turn-init means a live process, which may
      // arrive AFTER a late process-exit from a prior (already-replaced) session during reset.
      return {
        ...state,
        timeline: [item, ...state.timeline],
        sessionStarted: true,
        sessionId: event.sessionId,
        model: event.model,
        sessionEnded: false,
        exitCode: null,
        exitSignal: null,
      }
    }
    case 'assistant-text': {
      // If this messageId was already streamed, the block items exist. Skip atomic to avoid dupes.
      if (state.streamedMessageIds.has(event.messageId)) return state
      const item: TimelineItem = {
        kind: 'text',
        role: 'assistant',
        messageId: event.messageId,
        text: event.text,
        timestamp: ts,
      }
      return { ...state, timeline: [...state.timeline, item] }
    }
    case 'assistant-thinking': {
      if (state.streamedMessageIds.has(event.messageId)) return state
      const item: TimelineItem = {
        kind: 'thinking',
        messageId: event.messageId,
        text: event.text,
        hasSignature: event.hasSignature,
        timestamp: ts,
      }
      return { ...state, timeline: [...state.timeline, item] }
    }
    case 'tool-call': {
      // If already created via streaming (block-start), just fill in input (stream path may have
      // failed to parse partial_json) and leave status pending.
      const existingIdx = state.toolIndex.get(event.id)
      if (existingIdx !== undefined) {
        const target = state.timeline[existingIdx]
        if (target?.kind === 'tool') {
          const next: TimelineItem = {
            kind: 'tool',
            invocation: {
              ...target.invocation,
              name: target.invocation.name || event.name,
              input: target.invocation.input ?? event.input,
            },
            timestamp: target.timestamp,
          }
          const t = state.timeline.slice()
          t[existingIdx] = next
          return { ...state, timeline: t }
        }
      }
      const invocation: ToolInvocation = {
        id: event.id,
        name: event.name,
        input: event.input,
        status: 'pending',
      }
      const item: TimelineItem = { kind: 'tool', invocation, timestamp: ts }
      const newIndex = new Map(state.toolIndex)
      newIndex.set(event.id, state.timeline.length)
      return {
        ...state,
        timeline: [...state.timeline, item],
        toolIndex: newIndex,
      }
    }
    case 'stream-message-start': {
      // Do NOT add to `streamedMessageIds` yet — defer until a text/thinking block actually
      // materializes. This lets the atomic `assistant-*` fallback fire if stream produced no
      // content (e.g. tool-only messages, or aborted streams).
      return {
        ...state,
        currentStreamMessageId: event.messageId,
        openBlocks: new Map(),
      }
    }
    case 'stream-block-start': {
      const messageId = state.currentStreamMessageId
      if (!messageId) return state

      // For tool_use we materialize immediately — the tool name/id is user-visible right away.
      if (event.blockType === 'tool_use') {
        const invocation: ToolInvocation = {
          id: event.toolUseId ?? '',
          name: event.toolName ?? '',
          input: null,
          status: 'pending',
        }
        const item: TimelineItem = { kind: 'tool', invocation, timestamp: ts }
        const timelineIndex = state.timeline.length
        const nextOpen = new Map(state.openBlocks)
        nextOpen.set(event.blockIndex, {
          timelineIndex,
          blockType: 'tool_use',
          toolUseId: event.toolUseId,
          toolName: event.toolName,
          messageId,
          partialJson: '',
        })
        let nextToolIndex = state.toolIndex
        if (event.toolUseId) {
          nextToolIndex = new Map(state.toolIndex)
          nextToolIndex.set(event.toolUseId, timelineIndex)
        }
        return {
          ...state,
          timeline: [...state.timeline, item],
          openBlocks: nextOpen,
          toolIndex: nextToolIndex,
        }
      }

      // Text/thinking: defer materialization until first delta to avoid empty placeholders.
      const nextOpen = new Map(state.openBlocks)
      nextOpen.set(event.blockIndex, {
        timelineIndex: -1,
        blockType: event.blockType,
        messageId,
      })
      return { ...state, openBlocks: nextOpen }
    }
    case 'stream-block-delta': {
      const open = state.openBlocks.get(event.blockIndex)
      if (!open) return state

      // Deferred text/thinking: materialize on first content delta (ignore signature-only).
      if (open.timelineIndex === -1) {
        if (event.deltaType === 'signature') return state
        const messageId = open.messageId ?? state.currentStreamMessageId ?? ''
        const nextStreamed = new Set(state.streamedMessageIds)
        if (messageId) nextStreamed.add(messageId)
        if (open.blockType === 'text' && event.deltaType === 'text') {
          const item: TimelineItem = {
            kind: 'text',
            role: 'assistant',
            messageId,
            text: event.text,
            timestamp: ts,
          }
          const nextOpen = new Map(state.openBlocks)
          nextOpen.set(event.blockIndex, { ...open, timelineIndex: state.timeline.length })
          return {
            ...state,
            timeline: [...state.timeline, item],
            openBlocks: nextOpen,
            streamedMessageIds: nextStreamed,
          }
        }
        if (open.blockType === 'thinking' && event.deltaType === 'thinking') {
          const item: TimelineItem = {
            kind: 'thinking',
            messageId,
            text: event.text,
            hasSignature: false,
            timestamp: ts,
          }
          const nextOpen = new Map(state.openBlocks)
          nextOpen.set(event.blockIndex, { ...open, timelineIndex: state.timeline.length })
          return {
            ...state,
            timeline: [...state.timeline, item],
            openBlocks: nextOpen,
            streamedMessageIds: nextStreamed,
          }
        }
        return state
      }

      const target = state.timeline[open.timelineIndex]
      if (!target) return state
      if (event.deltaType === 'text' && target.kind === 'text') {
        const next: TimelineItem = { ...target, text: target.text + event.text }
        const t = state.timeline.slice()
        t[open.timelineIndex] = next
        return { ...state, timeline: t }
      }
      if (event.deltaType === 'thinking' && target.kind === 'thinking') {
        const next: TimelineItem = { ...target, text: target.text + event.text }
        const t = state.timeline.slice()
        t[open.timelineIndex] = next
        return { ...state, timeline: t }
      }
      if (event.deltaType === 'signature' && target.kind === 'thinking') {
        const next: TimelineItem = { ...target, hasSignature: true }
        const t = state.timeline.slice()
        t[open.timelineIndex] = next
        return { ...state, timeline: t }
      }
      if (event.deltaType === 'input_json' && target.kind === 'tool') {
        const nextOpen = new Map(state.openBlocks)
        nextOpen.set(event.blockIndex, {
          ...open,
          partialJson: (open.partialJson ?? '') + event.text,
        })
        return { ...state, openBlocks: nextOpen }
      }
      return state
    }
    case 'stream-block-stop': {
      const open = state.openBlocks.get(event.blockIndex)
      if (!open) return state
      const nextOpen = new Map(state.openBlocks)
      nextOpen.delete(event.blockIndex)
      if (open.blockType === 'tool_use' && open.partialJson) {
        const target = state.timeline[open.timelineIndex]
        if (target?.kind === 'tool') {
          let parsed: unknown = open.partialJson
          try {
            parsed = JSON.parse(open.partialJson)
          } catch {
            /* keep raw string as best-effort */
          }
          const next: TimelineItem = {
            kind: 'tool',
            invocation: { ...target.invocation, input: parsed },
            timestamp: target.timestamp,
          }
          const t = state.timeline.slice()
          t[open.timelineIndex] = next
          return { ...state, timeline: t, openBlocks: nextOpen }
        }
      }
      return { ...state, openBlocks: nextOpen }
    }
    case 'stream-message-stop':
      return { ...state, currentStreamMessageId: null, openBlocks: new Map() }
    case 'tool-result': {
      const idx = state.toolIndex.get(event.toolUseId)
      if (idx === undefined) {
        const invocation: ToolInvocation = {
          id: event.toolUseId,
          name: '',
          input: null,
          status: event.isError ? 'error' : 'done',
          result: { rawContent: event.rawContent, structured: event.structured, isError: event.isError },
        }
        const item: TimelineItem = { kind: 'tool', invocation, timestamp: ts }
        const newIndex = new Map(state.toolIndex)
        newIndex.set(event.toolUseId, state.timeline.length)
        return { ...state, timeline: [...state.timeline, item], toolIndex: newIndex }
      }
      const target = state.timeline[idx]
      if (target.kind !== 'tool') return state
      const nextInvocation: ToolInvocation = {
        ...target.invocation,
        status: event.isError ? 'error' : 'done',
        result: {
          rawContent: event.rawContent,
          structured: event.structured,
          isError: event.isError,
        },
      }
      const nextTimeline = state.timeline.slice()
      nextTimeline[idx] = { kind: 'tool', invocation: nextInvocation, timestamp: target.timestamp }
      return { ...state, timeline: nextTimeline }
    }
    case 'result': {
      // Collect this turn's assistant text (back to the last user-text or start) for Copy.
      const texts: string[] = []
      for (let i = state.timeline.length - 1; i >= 0; i--) {
        const it = state.timeline[i]
        if (it.kind === 'user-text') break
        if (it.kind === 'text' && it.role === 'assistant') texts.unshift(it.text)
      }
      const copyText = texts.length > 0 ? texts.join('\n\n') : null
      const item: TimelineItem = {
        kind: 'result',
        subtype: event.subtype,
        isError: event.isError,
        durationMs: event.durationMs,
        totalCostUsd: event.totalCostUsd,
        numTurns: event.numTurns,
        text: event.text,
        copyText,
        timestamp: ts,
      }
      return {
        ...state,
        timeline: [...state.timeline, item],
        lastResult: item,
        resultCount: state.resultCount + 1,
      }
    }
    case 'api-retry':
      return {
        ...state,
        timeline: [
          ...state.timeline,
          {
            kind: 'api-retry',
            attempt: event.attempt,
            maxRetries: event.maxRetries,
            delayMs: event.delayMs,
            error: event.error,
            timestamp: ts,
          },
        ],
      }
    case 'rate-limit':
      // Suppress 'allowed' / 'allowed_warning' — informational, not actionable. Only surface
      // blocked / exceeded / hard-limit statuses.
      if (event.status.startsWith('allowed')) return state
      return {
        ...state,
        timeline: [...state.timeline, { kind: 'rate-limit', status: event.status, timestamp: ts }],
      }
    case 'sub-agent':
      return {
        ...state,
        timeline: [...state.timeline, { kind: 'sub-agent', phase: event.phase, timestamp: ts }],
      }
    case 'compact-boundary':
      return state
    case 'stderr':
      return {
        ...state,
        timeline: [...state.timeline, { kind: 'stderr', text: event.text, timestamp: ts }],
      }
    case 'process-exit':
      return {
        ...state,
        sessionEnded: true,
        exitCode: event.code,
        exitSignal: event.signal,
      }
    case 'error':
      return {
        ...state,
        timeline: [...state.timeline, { kind: 'stderr', text: event.message, timestamp: ts }],
      }
    case 'unknown':
      // Silently drop — already logged main-side as `[chat-parser] unknown event type=X`.
      // UI noise w/ no signal; wire the event in the adapter when we learn what it is.
      return state
  }
}

/** Derive whether we're waiting for a response. True if user sent more messages than we've seen results for. */
export function isInFlight(state: ChatTimelineState): boolean {
  return state.userMessagesSent > state.resultCount
}
