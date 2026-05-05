import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type Key } from 'react'
import { useStickToBottom } from 'use-stick-to-bottom'
import {
  ArrowUp,
  Square,
  X as XIcon,
  Sparkles,
  ArrowDown,
  RotateCcw,
  Filter,
} from 'lucide-react'
import { ChatViewContext } from './ChatViewContext'
import { ChatSearchBar } from './ChatSearchBar'
import { useChatMode } from './useChatMode'
import { useChatModel } from './useChatModel'
import { useChatSearch } from './useChatSearch'
import {
  cn,
  toast,
  AgentModePill,
  AgentModelPill,
  nextAgentMode,
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Switch,
  useAppearance,
} from '@slayzone/ui'
import { ConfirmDisplayModeDialog } from '../ConfirmDisplayModeDialog'
import type { TabDisplayMode } from '../../shared/types'
import { useChatSession, useChatLoop, LoopModeBanner, BackgroundJobsBanner, PulseGrid, deriveLoadingLabel, type TimelineItem } from '@slayzone/terminal/client'
import type { LoopConfig } from '@slayzone/terminal/shared'
import { useImagePasteDrop, useAssetUpload, type AssetRef } from '@slayzone/editor'
import { AutocompleteMenu } from './autocomplete/AutocompleteMenu'
import { useAutocomplete } from './autocomplete/useAutocomplete'
import { createSkillsSource } from './autocomplete/sources/skills'
import { createCommandsSource } from './autocomplete/sources/commands'
import { createAgentsSource } from './autocomplete/sources/agents'
import { createBuiltinsSource } from './autocomplete/sources/builtins'
import { createFilesSource } from './autocomplete/sources/files'
import type { AutocompleteSource, ChatActions, NavigateActions } from './autocomplete/types'
import { resetChat } from './autocomplete/chat-actions'
import { mergeEffortFlag } from './autocomplete/flags'
import { renderTimelineItem, isRenderable } from './renderers'

export interface ChatPanelHandle {
  focus: () => void
}

export interface ChatPanelProps {
  tabId: string
  taskId: string
  mode: string
  cwd: string
  providerFlagsOverride?: string | null
  permissionNotice?: string | null
  onSetDisplayMode?: (target: TabDisplayMode) => void
  /** Persisted loop config (`tasks.loop_config`). Null = unconfigured. */
  loopConfig?: LoopConfig | null
  /** Persist loop config back to the task. */
  onLoopConfigChange?: (config: LoopConfig | null) => void
  /** Open the LoopModeDialog (lives at TaskDetailPage level — shared with terminal). */
  onOpenLoopDialog?: () => void
  /** Cmd+Click on a URL → in-app slay browser. Cmd+Shift+Click always external. */
  onOpenUrl?: (url: string) => void
  /** Cmd+Click on a file:line:col reference → editor pane. */
  onOpenFile?: (filePath: string, options?: { position?: { line: number; col?: number } }) => void
}

const SUGGESTED_PROMPTS = [
  'Explain what this codebase does',
  'Find the entry point',
  'What are the main dependencies?',
]

export const ChatPanel = forwardRef<ChatPanelHandle, ChatPanelProps>(function ChatPanel(props, ref) {
  const { tabId, taskId, mode, cwd, providerFlagsOverride, permissionNotice: overrideNotice, onSetDisplayMode, loopConfig, onLoopConfigChange, onOpenLoopDialog, onOpenUrl, onOpenFile } = props
  const { state, timeline, inFlight, hydrating, permissionMode, sendMessage, abortAndPop, reset: resetTimeline } = useChatSession({
    tabId,
    taskId,
    mode,
    cwd,
    providerFlagsOverride,
  })

  const appearance = useAppearance()
  const widthClass = appearance.chatWidth === 'wide' ? 'max-w-none' : 'max-w-4xl'
  const composerWidthClass = appearance.chatWidth === 'wide' ? 'max-w-4xl' : 'max-w-2xl'


  const loop = useChatLoop({
    timeline,
    inFlight,
    sessionEnded: state.sessionEnded,
    sendMessage: (text) => { void sendMessage(text) },
    onConfigChange: (cfg) => onLoopConfigChange?.(cfg),
  })

  const [draft, setDraft] = useState('')
  const [cursorPos, setCursorPos] = useState(0)
  const { chatMode, modeChanging, handleModeChange, autoCapability } = useChatMode({
    taskId, mode, tabId, cwd, livePermissionMode: permissionMode,
  })
  const { chatModel, modelChanging, handleModelChange } = useChatModel({
    taskId, mode, tabId, cwd,
  })
  const [collapseSignal, setCollapseSignal] = useState(0)
  const finalOnly = !appearance.chatShowTools
  const showLastMessageTools = appearance.chatShowLastMessageTools
  /** Send-text + original draft kept paired so usage bumps on drain see the
   * raw `/<token>` even when commands expanded the body before queueing. */
  const [queuedMessages, setQueuedMessages] = useState<Array<{ send: string; original: string }>>([])
  const [attachments, setAttachments] = useState<AssetRef[]>([])
  const { scrollRef, contentRef, isAtBottom, scrollToBottom } = useStickToBottom({
    initial: 'instant',
    resize: 'instant',
  })
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  // Snapshot of the in-flight turn's raw input + attachments. Used by Stop/Esc
  // to restore the chips + clean text (without inline image markdown) when the
  // main side pops the turn. Updated only on user submits that go straight to
  // the wire — queued submits don't overwrite it, so the snapshot stays aligned
  // with the in-flight turn even when a queue exists.
  const lastSentRef = useRef<{ text: string; attachments: AssetRef[] } | null>(null)

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
  }))

  const { uploadFiles: uploadImageFiles, getFilePath: getAssetFilePath } = useAssetUpload(taskId)

  const imagePasteDrop = useImagePasteDrop<AssetRef>({
    onUpload: uploadImageFiles,
    onInsert: (results) => {
      setAttachments((prev) => [...prev, ...results])
      textareaRef.current?.focus()
    },
    onError: (err) => toast(`Image upload failed: ${err instanceof Error ? err.message : String(err)}`),
  })

  const chatApi = useMemo<ChatActions>(() => {
    const api = (window as unknown as {
      api?: {
        chat?: {
          kill: (tabId: string) => Promise<void>
          remove: (tabId: string) => Promise<void>
          reset: (opts: {
            tabId: string
            taskId: string
            mode: string
            cwd: string
            providerFlagsOverride?: string | null
          }) => Promise<unknown>
          create: (opts: {
            tabId: string
            taskId: string
            mode: string
            cwd: string
            providerFlagsOverride?: string | null
          }) => Promise<unknown>
          send: (tabId: string, text: string) => Promise<boolean>
          interrupt: (opts: {
            tabId: string
            taskId: string
            mode: string
            cwd: string
            providerFlagsOverride?: string | null
          }) => Promise<unknown>
        }
      }
    }).api
    const chat = api?.chat
    return {
      kill: (id) => chat?.kill(id) ?? Promise.resolve(),
      remove: (id) => chat?.remove(id) ?? Promise.resolve(),
      reset: (opts) => chat?.reset(opts) ?? Promise.resolve(null),
      create: (opts) => chat?.create(opts) ?? Promise.resolve(null),
      send: (id, text) => chat?.send(id, text) ?? Promise.resolve(false),
      interrupt: (o) => chat?.interrupt(o) ?? Promise.resolve(null),
    }
  }, [])

  const navigate = useMemo<NavigateActions>(
    () => ({
      openSettings(tab) {
        window.dispatchEvent(new CustomEvent('open-settings', { detail: tab ?? 'appearance' }))
      },
      openExternal(url) {
        const api = (window as unknown as {
          api?: { shell?: { openExternal: (url: string) => Promise<unknown> } }
        }).api
        void api?.shell?.openExternal(url)
      },
      openFile(absPath) {
        const api = (window as unknown as {
          api?: { shell?: { openPath: (p: string) => Promise<string> } }
        }).api
        void api?.shell?.openPath(absPath)
      },
    }),
    []
  )

  const sources = useMemo(
    () => [
      createFilesSource(),
      createCommandsSource((text) => sendMessage(text).then(() => true)),
      createAgentsSource(),
      createBuiltinsSource(),
      createSkillsSource(),
    ],
    [sendMessage]
  ) as AutocompleteSource[]

  const autocomplete = useAutocomplete({
    sources,
    draft,
    setDraft,
    cursorPos,
    fetchCtx: { cwd },
    acceptCtx: {
      session: { tabId, taskId, mode, cwd, providerFlagsOverride: providerFlagsOverride ?? null },
      chat: chatApi,
      navigate,
      toast: (msg) => toast(msg),
    },
  })


  // When `finalOnly` is on, keep user msgs + result + the last assistant
  // text per turn. Drop thinking/tools/intermediate text/noise.
  // Always filter non-renderable items so virtualizer count matches visible DOM.
  // Also drop items with `parentToolUseId` set — those are sub-agent children,
  // rendered nested inside their parent SubAgentRow, not at the chat root.
  // When `showLastMessageTools` is on, tools after the last user message are
  // preserved so the user sees what the agent is doing right now.
  const displayedTimeline = useMemo<TimelineItem[]>(() => {
    const isRoot = (item: TimelineItem): boolean => item.parentToolUseId == null
    if (!finalOnly) return timeline.filter((item) => isRoot(item) && isRenderable(item))
    let lastUserIdx = -1
    if (showLastMessageTools) {
      for (let i = timeline.length - 1; i >= 0; i--) {
        if (isRoot(timeline[i]) && timeline[i].kind === 'user-text') {
          lastUserIdx = i
          break
        }
      }
    }
    const out: TimelineItem[] = []
    let pendingFinal: TimelineItem | null = null
    const flushPending = (): void => {
      if (pendingFinal) {
        out.push(pendingFinal)
        pendingFinal = null
      }
    }
    for (let i = 0; i < timeline.length; i++) {
      const item = timeline[i]
      if (!isRoot(item)) continue
      if (item.kind === 'user-text') {
        flushPending()
        out.push(item)
      } else if (item.kind === 'text' && item.role === 'assistant') {
        pendingFinal = item
      } else if (item.kind === 'tool' && item.invocation.name === 'ExitPlanMode') {
        flushPending()
        out.push(item)
      } else if (item.kind === 'tool' && showLastMessageTools && i > lastUserIdx) {
        flushPending()
        out.push(item)
      } else if (item.kind === 'thinking' && showLastMessageTools && i > lastUserIdx) {
        flushPending()
        out.push(item)
      } else if (item.kind === 'result') {
        flushPending()
        out.push(item)
      }
    }
    flushPending()
    return out.filter(isRenderable)
  }, [timeline, finalOnly, showLastMessageTools])

  const search = useChatSearch(displayedTimeline)

  // Paginate older items: show last `visibleCount`, expose "Show more" at top.
  const PAGE_SIZE = 100
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const hiddenCount = Math.max(0, displayedTimeline.length - visibleCount)
  const visibleStart = displayedTimeline.length - Math.min(visibleCount, displayedTimeline.length)
  const visibleItems = displayedTimeline.slice(visibleStart)

  // Auto-expand window if a search match lands above it.
  useEffect(() => {
    if (search.activeItemIdx < 0) return
    if (search.activeItemIdx < visibleStart) {
      setVisibleCount(displayedTimeline.length - search.activeItemIdx)
    }
  }, [search.activeItemIdx, visibleStart, displayedTimeline.length])

  // Stable per-item keys so streaming text updates re-render the same DOM node.
  const itemKey = useCallback((item: TimelineItem, index: number): Key => {
    if (item.kind === 'text' || item.kind === 'thinking') return `${item.kind}:${item.messageId}`
    if (item.kind === 'tool') return `tool:${item.invocation.id}`
    if (item.kind === 'session-start') return `session:${item.sessionId}`
    if (item.kind === 'result') return `result:${item.timestamp}`
    return `${item.kind}:${index}`
  }, [])


  // Adapt the `(path, { position })` signature used by host wiring to the flat
  // `(path, line, col)` shape LinkifiedText expects.
  const handleOpenFile = useMemo(() => {
    if (!onOpenFile) return undefined
    return (path: string, line?: number, col?: number) => {
      onOpenFile(path, line != null ? { position: { line, col } } : undefined)
    }
  }, [onOpenFile])

  const chatView = useMemo(
    () => ({
      collapseSignal,
      finalOnly,
      fileEditsOpenByDefault: appearance.chatFileEditsOpenByDefault,
      showMessageMeta: appearance.chatShowMessageMeta,
      search: { query: search.query, caseSensitive: search.caseSensitive },
      setChatMode: handleModeChange,
      timeline,
      childIndex: state.childIndex,
      onOpenUrl,
      onOpenFile: handleOpenFile,
    }),
    [collapseSignal, finalOnly, appearance.chatFileEditsOpenByDefault, appearance.chatShowMessageMeta, search.query, search.caseSensitive, handleModeChange, timeline, state.childIndex, onOpenUrl, handleOpenFile],
  )

  // Autosize textarea. Height follows scrollHeight up to 240px; no artificial min —
  // an empty draft renders as a single-line input.
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`
  }, [draft])

  const handleSend = useCallback(async () => {
    const text = draft.trim()
    if (state.sessionEnded) return
    if (!text && attachments.length === 0) return

    // Builtin `/effort <level>` — update session flags + restart. Doesn't send to chat.
    const effortMatch = /^\/effort\s+(\S+)\s*$/.exec(text)
    if (effortMatch) {
      const level = effortMatch[1].toLowerCase()
      const valid = ['low', 'medium', 'high', 'xhigh', 'max']
      if (!valid.includes(level)) {
        toast(`Invalid effort level "${level}". Use: ${valid.join(', ')}`)
        return
      }
      setDraft('')
      const nextFlags = mergeEffortFlag(providerFlagsOverride ?? null, level)
      await resetChat(
        chatApi,
        { tabId, taskId, mode, cwd, providerFlagsOverride: nextFlags },
        {
          interruptFirst: inFlight,
          onSuccess: () => toast(`Effort set to ${level}`),
          onError: (err) =>
            toast(`Effort change failed: ${err instanceof Error ? err.message : String(err)}`),
        }
      ).catch(() => {
        /* handled via onError */
      })
      return
    }

    // Allow sources (e.g. commands) to transform `/cmdname args` into expanded template.
    const transform = autocomplete.transformSubmit(text)
    let toSend = transform?.send ?? text

    // Materialize image attachments to abs filesystem paths and prepend to message.
    if (attachments.length > 0) {
      const resolved = await Promise.all(
        attachments.map(async (a) => {
          const p = await getAssetFilePath(a.id)
          return { ref: a, path: p }
        })
      )
      const missing = resolved.filter((r) => r.path === null)
      if (missing.length > 0) {
        toast(`${missing.length} image${missing.length === 1 ? '' : 's'} no longer available — skipping`)
      }
      const imageRefs = resolved
        .filter((r): r is { ref: AssetRef; path: string } => r.path !== null)
        .map((r) => `![${r.ref.title}](${r.path})`)
        .join('\n')
      toSend = imageRefs + (toSend ? `\n\n${toSend}` : '')
    }

    // Capture raw input + attachments BEFORE clearing — used by Stop/Esc to
    // restore them if the turn is popped. Skip when queueing: lastSentRef must
    // remain aligned with the in-flight turn, not the queued one.
    const snapshot = { text, attachments: [...attachments] }
    setDraft('')
    setAttachments([])
    if (!toSend) return
    // If a turn is in flight, queue for later. Drain effect flushes when inFlight drops.
    if (inFlight) {
      setQueuedMessages((q) => [...q, { send: toSend, original: text }])
      return
    }
    lastSentRef.current = snapshot
    await sendMessage(toSend)
    // Bump usage from the ORIGINAL `text` — slash tokens may not survive template
    // expansion. Only fires after sendMessage resolves (closest signal we have to
    // a successful send; sendMessage doesn't throw on failure). Read fn via ref
    // so we don't add `autocomplete` to deps — its returned object is a fresh
    // ref each render and would over-fire dependent effects.
    void bumpUsageRef.current(text)
  }, [draft, attachments, getAssetFilePath, inFlight, state.sessionEnded, sendMessage, autocomplete, chatApi, tabId, taskId, mode, cwd, providerFlagsOverride])

  // Stash bump fn in a ref. `autocomplete` is a fresh object every render
  // (useAutocomplete returns an object literal), so depending on it in the
  // drain useEffect would re-fire on every render and risk double-sends
  // before `inFlight` propagates back from the IPC roundtrip.
  const bumpUsageRef = useRef(autocomplete.bumpUsageFromMessage)
  bumpUsageRef.current = autocomplete.bumpUsageFromMessage

  // Drain queue: when the active turn finishes, send the next queued message.
  useEffect(() => {
    if (inFlight) return
    if (queuedMessages.length === 0) return
    if (state.sessionEnded) return
    const [next, ...rest] = queuedMessages
    setQueuedMessages(rest)
    void (async () => {
      await sendMessage(next.send)
      void bumpUsageRef.current(next.original)
    })()
  }, [inFlight, queuedMessages, sendMessage, state.sessionEnded])

  // Stop button + Esc shared path. Clears the queue (intentional: queued msgs
  // are abandoned alongside the in-flight turn), aborts the turn on the main
  // side, and — if no progress had arrived — restores the popped text +
  // attachments to the composer for editing. Skips restore when the user has
  // already started typing again (draft non-empty).
  const handleStop = useCallback(async () => {
    setQueuedMessages([])
    const result = await abortAndPop()
    if (!result.popped) return
    if (draft.trim() !== '') return
    const snap = lastSentRef.current
    if (snap) {
      setDraft(snap.text)
      setAttachments(snap.attachments)
    } else if (result.text) {
      setDraft(result.text)
    }
    lastSentRef.current = null
    textareaRef.current?.focus()
  }, [abortAndPop, draft])

  // Clear queue on session end / reset.
  useEffect(() => {
    if (state.sessionEnded) setQueuedMessages([])
  }, [state.sessionEnded])

  // Cmd+F / Ctrl+F opens search; Cmd+↑/↓ scrolls to top/bottom of the timeline.
  // Scoped to the panel that owns keyboard focus — multiple chat tabs stay
  // mounted (display:none) and a window-level listener would otherwise fire in
  // every panel simultaneously.
  useEffect(() => {
    const isFocusedHere = (): boolean => {
      const root = panelRef.current
      if (!root) return false
      const active = document.activeElement
      // Active element inside the panel? OR the panel itself has focus?
      // Also accept body-focus (no element focused) when the panel is the only
      // visible chat panel — heuristic: treat panel as "owner" when no other
      // chat panel sibling is currently focus-receiving.
      if (active && root.contains(active)) return true
      if (active === document.body) {
        // Find the closest visible ChatPanel ancestor of any input — if none,
        // and this panel is visible, claim ownership.
        const visibleSelf = root.offsetParent !== null
        if (!visibleSelf) return false
        const others = document.querySelectorAll('[data-chat-panel]')
        for (const o of Array.from(others)) {
          if (o === root) continue
          const el = o as HTMLElement
          if (el.offsetParent !== null) return false // another panel also visible — defer
        }
        return true
      }
      return false
    }
    const handler = (e: KeyboardEvent): void => {
      if (!isFocusedHere()) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault()
        search.requestOpen()
        return
      }
      if (mod && e.key === 'ArrowUp') {
        e.preventDefault()
        scrollRef.current?.scrollTo({ top: 0 })
        return
      }
      if (mod && e.key === 'ArrowDown') {
        e.preventDefault()
        const el = scrollRef.current
        if (el) el.scrollTo({ top: el.scrollHeight })
        return
      }
      // Shift+Tab cycles agent permission mode whenever the chat panel owns
      // focus — terminal-mode parity. Skipped while a turn is in flight (mode
      // change kills + respawns the subprocess) or while autocomplete consumes
      // Tab to accept the current selection.
      if (e.key === 'Tab' && e.shiftKey && !mod && !e.altKey) {
        if (autocomplete.show) return
        e.preventDefault()
        if (inFlight) return
        const next = nextAgentMode(chatMode, autoCapability.optedIn)
        handleModeChange(next).catch(() => { /* toast already shown by hook */ })
      }
      // Esc stops the in-flight turn — Claude CLI parity. Defers to autocomplete
      // (which uses Esc to close itself). No-op when nothing is in flight.
      if (e.key === 'Escape' && !mod && !e.altKey && !e.shiftKey) {
        if (autocomplete.show) return
        if (!inFlight) return
        e.preventDefault()
        void handleStop()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [scrollRef, search, inFlight, chatMode, handleModeChange, autoCapability.optedIn, autocomplete.show, handleStop])

  // Scroll to the active match.
  useEffect(() => {
    if (search.activeItemIdx < 0) return
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-index="${search.activeItemIdx}"]`)
    el?.scrollIntoView({ block: 'center' })
  }, [search.activeItemIdx, scrollRef])

  const copyAllMessages = useCallback(() => {
    const text = displayedTimeline
      .map((it) => {
        switch (it.kind) {
          case 'user-text': return `> ${it.text}`
          case 'text': return it.text
          case 'thinking': return `[thinking] ${it.text}`
          case 'result': return it.text ?? ''
          case 'tool': return `[tool: ${it.invocation.name}]`
          default: return ''
        }
      })
      .filter(Boolean)
      .join('\n\n')
    void navigator.clipboard.writeText(text)
    toast('Conversation copied')
  }, [displayedTimeline])

  const copyLastResponse = useCallback(() => {
    const last = [...displayedTimeline].reverse().find((it) => it.kind === 'text')
    if (last && last.kind === 'text') {
      void navigator.clipboard.writeText(last.text)
      toast('Last response copied')
    } else {
      toast('No response to copy')
    }
  }, [displayedTimeline])


  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (autocomplete.handleKeyDown(e)) return
      if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        void handleSend()
      }
    },
    [handleSend, autocomplete]
  )

  const copySessionId = useCallback(() => {
    if (!state.sessionId) return
    void navigator.clipboard.writeText(state.sessionId)
  }, [state.sessionId])

  const [resetting, setResetting] = useState(false)
  const [pendingChatDisable, setPendingChatDisable] = useState(false)
  // Suppress "Session ended" UI during a reset — process-exit fires between kill and
  // the new session's turn-init, creating a brief flash of the ended state.
  const displaySessionEnded = state.sessionEnded && !resetting
  const handleReset = useCallback(async () => {
    if (resetting) return
    setResetting(true)
    // Clear timeline + ended-state immediately so UI re-enables input while new session spawns.
    resetTimeline()
    setDraft('')
    setQueuedMessages([])
    try {
      await resetChat(
        chatApi,
        { tabId, taskId, mode, cwd, providerFlagsOverride: providerFlagsOverride ?? null },
        {
          interruptFirst: inFlight,
          onSuccess: () => toast('Chat reset'),
          onError: (err) =>
            toast(`Reset failed: ${err instanceof Error ? err.message : String(err)}`),
        }
      )
    } catch {
      /* handled via onError */
    } finally {
      setResetting(false)
    }
  }, [resetting, inFlight, chatApi, tabId, taskId, mode, cwd, providerFlagsOverride, resetTimeline])

  const isEmpty = timeline.length === 0 || (timeline.length === 1 && timeline[0].kind === 'session-start')

  return (
    <ChatViewContext.Provider value={chatView}>
    <div
      ref={panelRef}
      data-chat-panel
      className="relative flex flex-col h-full bg-background"
      style={{ fontSize: `${appearance.terminalFontSize}px` }}
      onDragEnter={(e) => {
        if (e.dataTransfer?.types.includes('Files')) {
          e.preventDefault()
          imagePasteDrop.onDragEnter()
        }
      }}
      onDragOver={(e) => {
        if (e.dataTransfer?.types.includes('Files')) e.preventDefault()
      }}
      onDragLeave={() => imagePasteDrop.onDragLeave()}
      onDrop={(e) => {
        const files = imagePasteDrop.extractImageFiles(e.dataTransfer)
        imagePasteDrop.resetDrag()
        if (files.length === 0) return
        e.preventDefault()
        void imagePasteDrop.handleFiles(files)
      }}
      onMouseUp={(e) => {
        // Click on panel background → focus composer. Skip if user clicked an
        // interactive element (button/link/input) or completed a text selection.
        const target = e.target as HTMLElement | null
        if (!target) return
        if (target.closest('button, a, input, textarea, select, [role="button"], [role="menuitem"], [contenteditable="true"]')) return
        const sel = window.getSelection()
        if (sel && !sel.isCollapsed) return
        textareaRef.current?.focus()
      }}
      onClickCapture={(e) => {
        // Event-delegated link interception for markdown-rendered anchors only.
        // Skip LinkifiedText anchors — they own their click semantics via
        // `data-linkified` and would otherwise double-fire (capture-phase parent
        // before child onClick).
        // Mirrors terminal modifier semantics:
        //   ⌘+Click       → in-app slay browser (onOpenUrl)
        //   ⌘+Shift+Click → external
        //   bare click    → external (markdown anchors are click affordances;
        //                  doing nothing on bare click would feel broken).
        const target = e.target as HTMLElement | null
        const anchor = target?.closest('a[href]') as HTMLAnchorElement | null
        if (!anchor) return
        if (anchor.dataset.linkified === 'true') return
        const href = anchor.getAttribute('href') ?? ''
        if (!/^https?:\/\//i.test(href)) return
        e.preventDefault()
        const mod = e.metaKey || e.ctrlKey
        if (mod && e.shiftKey) navigate.openExternal(href)
        else if (mod && onOpenUrl) onOpenUrl(href)
        else navigate.openExternal(href)
      }}
    >
      {/* Panel-wide drop overlay */}
      {imagePasteDrop.isDragging && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-primary/5 ring-2 ring-inset ring-primary/60 text-sm text-primary/80">
          Drop image…
        </div>
      )}
      {/* Header: mode pill + (override notice if explicitly passed by parent) */}
      {overrideNotice && (
        <div className="px-4 py-2 text-xs bg-amber-500/10 border-b border-amber-500/30 text-amber-800 dark:text-amber-300">
          {overrideNotice}
        </div>
      )}
      {/* Search bar — Cmd+F overlay */}
      {search.open && (
        <ChatSearchBar
          query={search.query}
          onQueryChange={search.setQuery}
          caseSensitive={search.caseSensitive}
          onCaseSensitiveChange={search.setCaseSensitive}
          resultCount={search.matchCount}
          resultIndex={search.activeIdx}
          onPrev={search.prev}
          onNext={search.next}
          onClose={search.close}
          focusToken={search.focusToken}
        />
      )}

      {/* Banner stack — single positioned column at top-right of the timeline
          area. Each banner is non-floating; the column owns layout so adding
          a third banner in the future is one line. */}
      {(() => {
        const showLoop = Boolean(loopConfig?.prompt && loopConfig?.criteriaPattern && onOpenLoopDialog)
        const showBgJobs = state.bgShells.size > 0
        if (!showLoop && !showBgJobs) return null
        return (
          <div className="pointer-events-none absolute top-6 right-6 z-20 flex flex-col gap-3">
            {showLoop && (
              <div className="pointer-events-auto">
                <LoopModeBanner
                  floating={false}
                  config={loopConfig!}
                  status={loop.status}
                  iteration={loop.iteration}
                  onStart={loop.startLoop}
                  onPause={loop.pauseLoop}
                  onResume={loop.resumeLoop}
                  onStop={loop.stopLoop}
                  onEditConfig={onOpenLoopDialog!}
                />
              </div>
            )}
            {showBgJobs && (
              <div className="pointer-events-auto">
                <BackgroundJobsBanner
                  floating={false}
                  shells={state.bgShells}
                  order={state.bgShellOrder}
                />
              </div>
            )}
          </div>
        )
      })()}

      {/* Timeline */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
      <div className="relative flex-1 min-h-0">
        <div ref={scrollRef} className="h-full overflow-y-auto pt-4">
          <div className={cn('mx-auto w-full', widthClass)}>
            {hydrating ? (
              <HydratingState />
            ) : isEmpty && !inFlight ? (
              <EmptyState
                onPick={(text) => {
                  void sendMessage(text)
                }}
              />
            ) : (
              <div ref={contentRef}>
                {hiddenCount > 0 && (
                  <div className="flex justify-center py-2">
                    <button
                      onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                      className="text-xs text-muted-foreground hover:text-foreground rounded-md px-3 py-1 border border-border/50 hover:bg-muted/60 transition-colors"
                    >
                      Show {Math.min(PAGE_SIZE, hiddenCount)} earlier
                      {hiddenCount > PAGE_SIZE ? ` (${hiddenCount} hidden)` : ''}
                    </button>
                  </div>
                )}
                {visibleItems.map((item, i) => {
                  const index = visibleStart + i
                  const rendered = renderTimelineItem(item, index)
                  if (rendered === null) return null
                  return (
                    <div key={itemKey(item, index)} data-index={index}>
                      {rendered}
                    </div>
                  )
                })}
              </div>
            )}
            {inFlight && <TypingIndicator label={deriveLoadingLabel(state)} />}
          </div>
        </div>

        {/* Jump-to-latest button */}
        {!isAtBottom && (
          <button
            onClick={() => void scrollToBottom()}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background border border-border shadow-md text-xs hover:bg-muted transition-colors"
          >
            <ArrowDown className="size-3" />
            Jump to latest
          </button>
        )}
      </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={copyLastResponse}>Copy last response</ContextMenuItem>
          <ContextMenuItem onSelect={copyAllMessages}>Copy entire conversation</ContextMenuItem>
          {state.sessionId && (
            <ContextMenuItem onSelect={copySessionId}>
              Copy session id
            </ContextMenuItem>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={search.requestOpen}>
            Find in chat… (⌘F)
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => setCollapseSignal((n) => n + 1)}>
            Collapse all expanded blocks
          </ContextMenuItem>
          <ContextMenuSub>
            <ContextMenuSubTrigger>Width</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuRadioGroup
                value={appearance.chatWidth}
                onValueChange={(v) => {
                  window.api.settings.set('chat_width', v)
                  window.dispatchEvent(new CustomEvent('sz:settings-changed'))
                }}
              >
                <ContextMenuRadioItem value="narrow">Narrow</ContextMenuRadioItem>
                <ContextMenuRadioItem value="wide">Wide</ContextMenuRadioItem>
              </ContextMenuRadioGroup>
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuItem onSelect={() => { void handleReset() }} disabled={resetting}>
            Reset chat
          </ContextMenuItem>
          {onSetDisplayMode && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem onSelect={() => setPendingChatDisable(true)}>
                Disable chat
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      {/* Composer */}
      <div className="bg-background px-4 pt-3 pb-1">
        <div className={cn('mx-auto w-full', composerWidthClass)}>
        {queuedMessages.length > 0 && (
          <div className="mb-2">
            <div className="px-1 mb-1 text-[10px] uppercase tracking-wide text-muted-foreground/60">
              Up next · {queuedMessages.length}
            </div>
            <ul className="divide-y divide-border/40 rounded-md border border-border/40 overflow-hidden">
              {queuedMessages.map((msg, i) => (
                <li
                  key={i}
                  className="group flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted/30"
                >
                  <span className="shrink-0 text-muted-foreground/50 font-mono text-[10px] tabular-nums">
                    {i + 1}.
                  </span>
                  <span className="flex-1 min-w-0 truncate">{msg.send}</span>
                  <button
                    onClick={() =>
                      setQueuedMessages((q) => q.filter((_, idx) => idx !== i))
                    }
                    className="shrink-0 rounded p-0.5 opacity-50 hover:opacity-100 hover:bg-destructive/15 hover:text-destructive transition-colors"
                    aria-label="Cancel queued message"
                    title="Cancel"
                  >
                    <XIcon className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-1.5 px-1">
            {attachments.map((a, i) => (
              <span
                key={`${a.id}-${i}`}
                className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[11px] text-muted-foreground"
                title={a.title}
              >
                <span className="max-w-[160px] truncate">{a.title}</span>
                <button
                  type="button"
                  onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                  className="rounded p-0.5 hover:bg-destructive/15 hover:text-destructive transition-colors"
                  aria-label="Remove attachment"
                >
                  <XIcon className="size-2.5" />
                </button>
              </span>
            ))}
            {imagePasteDrop.isUploading && (
              <span className="text-[11px] text-muted-foreground/60">uploading…</span>
            )}
          </div>
        )}
        <div
          className={cn(
            'relative flex items-center gap-2 rounded-2xl bg-muted/40 ring-1 ring-border/60 px-3 py-1.5 transition-shadow',
            displaySessionEnded && 'opacity-50 pointer-events-none'
          )}
          onPaste={(e) => {
            const files = imagePasteDrop.extractImageFiles(e.clipboardData)
            if (files.length === 0) return
            e.preventDefault()
            void imagePasteDrop.handleFiles(files)
          }}
        >
          {autocomplete.show && autocomplete.active && (
            <AutocompleteMenu
              active={autocomplete.active}
              selectedIndex={autocomplete.selectedIndex}
              onSelect={(i) => {
                autocomplete.accept(i)
                textareaRef.current?.focus()
              }}
              onHover={autocomplete.setSelectedIndex}
            />
          )}
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              setCursorPos(e.target.selectionStart ?? e.target.value.length)
            }}
            onSelect={(e) => {
              const el = e.currentTarget
              setCursorPos(el.selectionStart ?? el.value.length)
            }}
            onKeyUp={(e) => {
              const el = e.currentTarget
              setCursorPos(el.selectionStart ?? el.value.length)
            }}
            onKeyDown={onKeyDown}
            placeholder={displaySessionEnded ? 'Session ended' : 'Ask Claude anything…'}
            disabled={displaySessionEnded}
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/60 max-h-[240px] py-0.5 leading-normal"
          />
          {inFlight ? (
            <button
              onClick={() => {
                void handleStop()
              }}
              disabled={displaySessionEnded}
              className="shrink-0 size-8 rounded-full flex items-center justify-center bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
              title="Stop generation (Esc)"
              aria-label="Stop generation"
            >
              <Square className="size-3.5 fill-current" />
            </button>
          ) : (
            <button
              onClick={() => {
                void handleSend()
              }}
              disabled={(!draft.trim() && attachments.length === 0) || displaySessionEnded || imagePasteDrop.isUploading}
              className={cn(
                'shrink-0 size-8 rounded-full flex items-center justify-center transition-colors',
                (draft.trim() || attachments.length > 0) && !displaySessionEnded && !imagePasteDrop.isUploading
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              )}
              title="Send (Enter)"
              aria-label="Send"
            >
              <ArrowUp className="size-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1.5 px-1 text-[10px] text-muted-foreground/60">
          <AgentModePill
            mode={chatMode}
            onChange={(next) => { handleModeChange(next).catch(() => { /* toast already shown by hook */ }) }}
            disabled={modeChanging || inFlight}
            compact
            variant="text"
            autoCapability={autoCapability}
          />
          <AgentModelPill
            model={chatModel}
            onChange={(next) => { void handleModelChange(next) }}
            disabled={modelChanging || inFlight}
            compact
            variant="text"
          />
          {appearance.chatWidth === 'wide' && (
            <span>
              {inFlight
                ? 'Enter to queue · Shift+Enter for newline'
                : 'Enter to send · Shift+Enter for newline'}
            </span>
          )}
          <div className="flex-1" />
          {displaySessionEnded && <span className="text-destructive">Session ended</span>}
          <Popover>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  'flex items-center gap-1 px-1.5 py-0.5 rounded-md transition-colors',
                  finalOnly
                    ? 'bg-primary/15 text-foreground'
                    : 'hover:bg-muted/60 hover:text-foreground'
                )}
                title="Display options"
              >
                <Filter className="size-3" />
                Display
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-3 space-y-3">
              <DisplayOptionRow
                label="Show tools"
                description="Show all tool calls inline. When off, only user messages + final assistant reply per turn."
                checked={appearance.chatShowTools}
                onCheckedChange={(c) => {
                  window.api.settings.set('chat_show_tools', c ? '1' : '0')
                  window.dispatchEvent(new CustomEvent('sz:settings-changed'))
                }}
              />
              <DisplayOptionRow
                label="Show last message tools"
                description="When tools are hidden, still show tools after the most recent user message."
                checked={showLastMessageTools}
                disabled={appearance.chatShowTools}
                onCheckedChange={(c) => {
                  window.api.settings.set('chat_show_last_message_tools', c ? '1' : '0')
                  window.dispatchEvent(new CustomEvent('sz:settings-changed'))
                }}
              />
              <DisplayOptionRow
                label="File edits opened by default"
                description="Auto-expand Edit and Write tool cards."
                checked={appearance.chatFileEditsOpenByDefault}
                onCheckedChange={(c) => {
                  window.api.settings.set('chat_file_edits_open_by_default', c ? '1' : '0')
                  window.dispatchEvent(new CustomEvent('sz:settings-changed'))
                }}
              />
              <DisplayOptionRow
                label="Show message meta"
                description="Per-turn footer with duration, cost, and turn count."
                checked={appearance.chatShowMessageMeta}
                onCheckedChange={(c) => {
                  window.api.settings.set('chat_show_message_meta', c ? '1' : '0')
                  window.dispatchEvent(new CustomEvent('sz:settings-changed'))
                }}
              />
            </PopoverContent>
          </Popover>
          <button
            onClick={() => {
              void handleReset()
            }}
            disabled={resetting}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-md hover:bg-muted/60 hover:text-foreground transition-colors disabled:opacity-50"
            title="Reset chat (kill session and start fresh)"
          >
            <RotateCcw className={cn('size-3', resetting && 'animate-spin')} />
            Reset
          </button>
        </div>
        </div>
      </div>

      <ConfirmDisplayModeDialog
        open={pendingChatDisable}
        target="xterm"
        onConfirm={() => {
          onSetDisplayMode?.('xterm')
          setPendingChatDisable(false)
        }}
        onCancel={() => setPendingChatDisable(false)}
      />
    </div>
    </ChatViewContext.Provider>
  )
})

function DisplayOptionRow({
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string
  description: string
  checked: boolean
  disabled?: boolean
  onCheckedChange: (next: boolean) => void
}) {
  return (
    <div className={cn('flex items-start gap-3', disabled && 'opacity-50')}>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-foreground">{label}</div>
        <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">{description}</div>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} className="mt-0.5" />
    </div>
  )
}

function HydratingState() {
  return (
    <div className="h-full relative">
      <PulseGrid />
    </div>
  )
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="h-full flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="size-12 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white shadow-lg mb-4">
        <Sparkles className="size-5" />
      </div>
      <div className="text-base font-medium">Chat with Claude Code</div>
      <div className="text-sm text-muted-foreground mt-1 mb-6">
        Structured responses. Diffs, file reads, and tool calls rendered inline.
      </div>
      <div className="flex flex-col gap-1.5 w-full max-w-sm">
        {SUGGESTED_PROMPTS.map((p) => (
          <button
            key={p}
            onClick={() => onPick(p)}
            className="text-left text-xs px-3 py-2 rounded-lg border border-border/60 hover:bg-muted/60 hover:border-border transition-colors"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  )
}

function TypingIndicator({ label }: { label?: string | null }) {
  return (
    <div className="px-4 py-2 flex gap-3 items-center">
      <div className="shrink-0 size-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white shadow-sm">
        <Sparkles className="size-3.5 animate-pulse" />
      </div>
      <div className="flex gap-1 px-3 py-2 rounded-2xl bg-muted/40">
        <span className="size-1.5 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="size-1.5 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="size-1.5 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      {label && (
        <span className="text-xs text-muted-foreground truncate max-w-[60ch]">{label}</span>
      )}
    </div>
  )
}
