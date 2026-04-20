import { useEffect, useReducer, useRef } from 'react'
import type { AgentEvent } from '../shared/agent-events'
import {
  initialState,
  reducer,
  isInFlight,
  type ChatTimelineState,
  type TimelineItem,
} from './chat-timeline'

// We don't import ElectronAPI types here to avoid a cycle. The `chat` namespace shape
// is duplicated as a minimal interface; the real type lives in @slayzone/types/api.ts.
interface ChatApi {
  create: (opts: {
    tabId: string
    taskId: string
    mode: string
    cwd: string
    providerFlagsOverride?: string | null
  }) => Promise<unknown>
  send: (tabId: string, text: string) => Promise<boolean>
  interrupt: (tabId: string) => Promise<void>
  kill: (tabId: string) => Promise<void>
  remove: (tabId: string) => Promise<void>
  getBufferSince: (
    tabId: string,
    afterSeq: number
  ) => Promise<Array<{ seq: number; event: AgentEvent }>>
  inspectPermissions: (
    taskId: string,
    mode: string
  ) => Promise<{
    ok: boolean
    hasSkipPerms: boolean
    hasPermissionMode: boolean
    permissionModeValue: string | null
  }>
  onEvent: (cb: (tabId: string, event: AgentEvent, seq: number) => void) => () => void
  onExit: (cb: (tabId: string, code: number | null, signal: string | null) => void) => () => void
}

function getChatApi(): ChatApi {
  const api = (window as unknown as { api: { chat: ChatApi } }).api
  return api.chat
}

export interface UseChatSessionResult {
  state: ChatTimelineState
  timeline: TimelineItem[]
  inFlight: boolean
  sendMessage: (text: string) => Promise<void>
  interrupt: () => Promise<void>
  kill: () => Promise<void>
  /** Clear timeline + ended-state immediately (UX). New turn-init refills on next session. */
  reset: () => void
}

export interface UseChatSessionOpts {
  tabId: string
  taskId: string
  mode: string
  cwd: string
  /** Optional override. Defaults to falling back to task mode defaults on the main side. */
  providerFlagsOverride?: string | null
}

/**
 * React hook that spawns and subscribes to a chat session for one tab.
 *
 * Lifecycle:
 * 1. On mount: call chat:create (main process spawns or returns existing session).
 * 2. Subscribe to chat:event and chat:exit, filter by tabId, feed into reducer.
 * 3. Replay buffered events via getBufferSince(tabId, -1) so tab re-open sees prior state.
 * 4. On unmount: unsubscribe only. Session persists (main keeps buffer). Tab close triggers chat:remove via useTaskTerminals.
 */
export function useChatSession(opts: UseChatSessionOpts): UseChatSessionResult {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)
  const lastSeqRef = useRef<number>(-1)

  useEffect(() => {
    let cancelled = false
    const chat = getChatApi()

    // Kick off session (idempotent — main returns existing if any)
    chat.create({
      tabId: opts.tabId,
      taskId: opts.taskId,
      mode: opts.mode,
      cwd: opts.cwd,
      providerFlagsOverride: opts.providerFlagsOverride ?? null,
    }).catch((e) => {
      // Surface to UI via stderr-like entry.
      dispatch({
        type: 'event',
        event: { kind: 'error', message: (e as Error).message ?? String(e) },
      })
    })

    // Replay buffered events. Note: we request AFTER create so any init events are buffered.
    void chat
      .getBufferSince(opts.tabId, -1)
      .then((buffered) => {
        if (cancelled) return
        for (const { seq, event } of buffered) {
          if (seq > lastSeqRef.current) {
            dispatch({ type: 'event', event })
            lastSeqRef.current = seq
          }
        }
      })
      .catch(() => {
        /* ignore replay failures */
      })

    const offEvent = chat.onEvent((tabId, event, seq) => {
      if (cancelled || tabId !== opts.tabId) return
      if (seq <= lastSeqRef.current) return
      lastSeqRef.current = seq
      dispatch({ type: 'event', event })
    })

    const offExit = chat.onExit((tabId, code, signal) => {
      if (cancelled || tabId !== opts.tabId) return
      dispatch({ type: 'process-exit', code, signal })
    })

    return () => {
      cancelled = true
      offEvent()
      offExit()
    }
  }, [opts.tabId, opts.taskId, opts.mode, opts.cwd, opts.providerFlagsOverride])

  const sendMessage = async (text: string): Promise<void> => {
    const chat = getChatApi()
    // Optimistically add user message to timeline before network round-trip.
    dispatch({ type: 'user-sent', text })
    await chat.send(opts.tabId, text)
  }

  const interrupt = async (): Promise<void> => {
    const chat = getChatApi()
    await chat.interrupt(opts.tabId)
  }

  const kill = async (): Promise<void> => {
    const chat = getChatApi()
    await chat.kill(opts.tabId)
  }

  const reset = (): void => {
    dispatch({ type: 'reset' })
    lastSeqRef.current = -1
  }

  return {
    state,
    timeline: state.timeline,
    inFlight: isInFlight(state),
    sendMessage,
    interrupt,
    kill,
    reset,
  }
}
