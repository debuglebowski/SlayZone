import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useCallback,
  useState,
  useMemo,
  type ReactNode
} from 'react'
import type { TerminalState, PromptInfo } from '@omgslayzone/terminal/shared'

export type CodeMode = 'normal' | 'plan' | 'accept-edits' | 'bypass'

// Per-task state - no buffer (backend is source of truth)
interface PtyState {
  lastSeq: number // Last sequence number received for ordering
  exitCode?: number
  sessionInvalid: boolean
  state: TerminalState
  pendingPrompt?: PromptInfo
  quickRunPrompt?: string
  quickRunCodeMode?: CodeMode
}

type DataCallback = (data: string, seq: number) => void
type ExitCallback = (exitCode: number) => void
type SessionInvalidCallback = () => void
type IdleCallback = () => void
type StateChangeCallback = (newState: TerminalState, oldState: TerminalState) => void
type PromptCallback = (prompt: PromptInfo) => void
type SessionDetectedCallback = (sessionId: string) => void

interface PtyContextValue {
  subscribe: (taskId: string, cb: DataCallback) => () => void
  subscribeExit: (taskId: string, cb: ExitCallback) => () => void
  subscribeSessionInvalid: (taskId: string, cb: SessionInvalidCallback) => () => void
  subscribeIdle: (taskId: string, cb: IdleCallback) => () => void
  subscribeState: (taskId: string, cb: StateChangeCallback) => () => void
  subscribePrompt: (taskId: string, cb: PromptCallback) => () => void
  subscribeSessionDetected: (taskId: string, cb: SessionDetectedCallback) => () => void
  getLastSeq: (taskId: string) => number
  getExitCode: (taskId: string) => number | undefined
  isSessionInvalid: (taskId: string) => boolean
  getState: (taskId: string) => TerminalState
  getPendingPrompt: (taskId: string) => PromptInfo | undefined
  clearPendingPrompt: (taskId: string) => void
  resetTaskState: (taskId: string) => void
  cleanupTask: (taskId: string) => void // Free all memory for a task
  // Global prompt tracking for badge
  getPendingPromptTaskIds: () => string[]
  // Quick run prompt
  setQuickRunPrompt: (taskId: string, prompt: string, codeMode?: CodeMode) => void
  getQuickRunPrompt: (taskId: string) => string | undefined
  getQuickRunCodeMode: (taskId: string) => CodeMode | undefined
  clearQuickRunPrompt: (taskId: string) => void
}

const PtyContext = createContext<PtyContextValue | null>(null)

export function PtyProvider({ children }: { children: ReactNode }) {
  // Per-taskId state (metadata only - backend is source of truth for buffer)
  const statesRef = useRef<Map<string, PtyState>>(new Map())

  // Per-taskId subscriber sets
  const dataSubsRef = useRef<Map<string, Set<DataCallback>>>(new Map())
  const exitSubsRef = useRef<Map<string, Set<ExitCallback>>>(new Map())
  const sessionInvalidSubsRef = useRef<Map<string, Set<SessionInvalidCallback>>>(new Map())
  const idleSubsRef = useRef<Map<string, Set<IdleCallback>>>(new Map())
  const stateSubsRef = useRef<Map<string, Set<StateChangeCallback>>>(new Map())
  const promptSubsRef = useRef<Map<string, Set<PromptCallback>>>(new Map())
  const sessionDetectedSubsRef = useRef<Map<string, Set<SessionDetectedCallback>>>(new Map())

  // Track task IDs with pending prompts for global badge
  const [pendingPromptTaskIds, setPendingPromptTaskIds] = useState<Set<string>>(new Set())
  // Ref for stable getPendingPromptTaskIds callback
  const pendingPromptTaskIdsRef = useRef(pendingPromptTaskIds)
  pendingPromptTaskIdsRef.current = pendingPromptTaskIds

  const getOrCreateState = useCallback((taskId: string): PtyState => {
    let state = statesRef.current.get(taskId)
    if (!state) {
      state = { lastSeq: -1, sessionInvalid: false, state: 'starting' }
      statesRef.current.set(taskId, state)
    }
    return state
  }, [])

  // Global listeners - survive all view changes
  // Note: Only update existing state, don't create state for unknown tasks
  // State is created when Terminal component subscribes
  useEffect(() => {
    const unsubData = window.api.pty.onData((taskId, data, seq) => {
      const state = statesRef.current.get(taskId)
      if (!state) return

      // Drop out-of-order data (seq should be monotonically increasing)
      if (seq <= state.lastSeq) return
      state.lastSeq = seq

      // Notify subscribers
      const subs = dataSubsRef.current.get(taskId)
      if (subs) {
        subs.forEach((cb) => cb(data, seq))
      }
    })

    const unsubExit = window.api.pty.onExit((taskId, exitCode) => {
      const state = statesRef.current.get(taskId)
      if (!state) return // Ignore exit for unknown tasks

      state.exitCode = exitCode

      const subs = exitSubsRef.current.get(taskId)
      if (subs) {
        subs.forEach((cb) => cb(exitCode))
      }
    })

    const unsubSessionNotFound = window.api.pty.onSessionNotFound((taskId) => {
      const state = statesRef.current.get(taskId)
      if (!state) return // Ignore for unknown tasks

      state.sessionInvalid = true

      const subs = sessionInvalidSubsRef.current.get(taskId)
      if (subs) {
        subs.forEach((cb) => cb())
      }
    })

    const unsubIdle = window.api.pty.onIdle((taskId) => {
      const subs = idleSubsRef.current.get(taskId)
      if (subs) {
        subs.forEach((cb) => cb())
      }
    })

    const unsubStateChange = window.api.pty.onStateChange((taskId, newState, oldState) => {
      const state = statesRef.current.get(taskId)
      if (!state) return // Ignore state changes for unknown tasks

      state.state = newState as TerminalState

      const subs = stateSubsRef.current.get(taskId)
      if (subs) {
        subs.forEach((cb) => cb(newState as TerminalState, oldState as TerminalState))
      }

      // Clear pending prompt when state changes from awaiting_input
      if (oldState === 'awaiting_input' && newState !== 'awaiting_input') {
        state.pendingPrompt = undefined
        setPendingPromptTaskIds((prev) => {
          const next = new Set(prev)
          next.delete(taskId)
          return next
        })
      }
    })

    const unsubPrompt = window.api.pty.onPrompt((taskId, prompt) => {
      const state = statesRef.current.get(taskId)
      if (!state) return // Ignore prompts for unknown tasks

      state.pendingPrompt = prompt

      // Update global tracking
      setPendingPromptTaskIds((prev) => new Set(prev).add(taskId))

      const subs = promptSubsRef.current.get(taskId)
      if (subs) {
        subs.forEach((cb) => cb(prompt))
      }
    })

    const unsubSessionDetected = window.api.pty.onSessionDetected((taskId, sessionId) => {
      const subs = sessionDetectedSubsRef.current.get(taskId)
      if (subs) {
        subs.forEach((cb) => cb(sessionId))
      }
    })

    return () => {
      unsubData()
      unsubExit()
      unsubSessionNotFound()
      unsubIdle()
      unsubStateChange()
      unsubPrompt()
      unsubSessionDetected()
    }
  }, [getOrCreateState])

  const subscribe = useCallback((taskId: string, cb: DataCallback): (() => void) => {
    // Ensure state exists so onData doesn't drop data
    getOrCreateState(taskId)

    let subs = dataSubsRef.current.get(taskId)
    if (!subs) {
      subs = new Set()
      dataSubsRef.current.set(taskId, subs)
    }
    subs.add(cb)
    return () => {
      subs!.delete(cb)
    }
  }, [getOrCreateState])

  const subscribeExit = useCallback((taskId: string, cb: ExitCallback): (() => void) => {
    let subs = exitSubsRef.current.get(taskId)
    if (!subs) {
      subs = new Set()
      exitSubsRef.current.set(taskId, subs)
    }
    subs.add(cb)
    return () => {
      subs!.delete(cb)
    }
  }, [])

  const subscribeSessionInvalid = useCallback(
    (taskId: string, cb: SessionInvalidCallback): (() => void) => {
      let subs = sessionInvalidSubsRef.current.get(taskId)
      if (!subs) {
        subs = new Set()
        sessionInvalidSubsRef.current.set(taskId, subs)
      }
      subs.add(cb)
      return () => {
        subs!.delete(cb)
      }
    },
    []
  )

  const subscribeIdle = useCallback((taskId: string, cb: IdleCallback): (() => void) => {
    let subs = idleSubsRef.current.get(taskId)
    if (!subs) {
      subs = new Set()
      idleSubsRef.current.set(taskId, subs)
    }
    subs.add(cb)
    return () => {
      subs!.delete(cb)
    }
  }, [])

  const subscribeState = useCallback((taskId: string, cb: StateChangeCallback): (() => void) => {
    let subs = stateSubsRef.current.get(taskId)
    if (!subs) {
      subs = new Set()
      stateSubsRef.current.set(taskId, subs)
    }
    subs.add(cb)

    // Fetch initial state from backend if we don't have it yet
    const state = statesRef.current.get(taskId)
    if (!state || state.state === 'starting') {
      window.api.pty.getState(taskId).then((backendState) => {
        if (backendState) {
          const localState = getOrCreateState(taskId)
          if (localState.state !== backendState) {
            const oldState = localState.state
            localState.state = backendState
            // Notify all subscribers of the initial state
            const currentSubs = stateSubsRef.current.get(taskId)
            if (currentSubs) {
              currentSubs.forEach((sub) => sub(backendState, oldState))
            }
          }
        }
      })
    }

    return () => {
      subs!.delete(cb)
    }
  }, [getOrCreateState])

  const subscribePrompt = useCallback((taskId: string, cb: PromptCallback): (() => void) => {
    let subs = promptSubsRef.current.get(taskId)
    if (!subs) {
      subs = new Set()
      promptSubsRef.current.set(taskId, subs)
    }
    subs.add(cb)
    return () => {
      subs!.delete(cb)
    }
  }, [])

  const subscribeSessionDetected = useCallback(
    (taskId: string, cb: SessionDetectedCallback): (() => void) => {
      let subs = sessionDetectedSubsRef.current.get(taskId)
      if (!subs) {
        subs = new Set()
        sessionDetectedSubsRef.current.set(taskId, subs)
      }
      subs.add(cb)
      return () => {
        subs!.delete(cb)
      }
    },
    []
  )

  const getLastSeq = useCallback((taskId: string): number => {
    return statesRef.current.get(taskId)?.lastSeq ?? -1
  }, [])

  const getExitCode = useCallback((taskId: string): number | undefined => {
    return statesRef.current.get(taskId)?.exitCode
  }, [])

  const isSessionInvalid = useCallback((taskId: string): boolean => {
    return statesRef.current.get(taskId)?.sessionInvalid ?? false
  }, [])

  const getState = useCallback((taskId: string): TerminalState => {
    return statesRef.current.get(taskId)?.state ?? 'starting'
  }, [])

  const getPendingPrompt = useCallback((taskId: string): PromptInfo | undefined => {
    return statesRef.current.get(taskId)?.pendingPrompt
  }, [])

  const clearPendingPrompt = useCallback((taskId: string): void => {
    const state = statesRef.current.get(taskId)
    if (state) {
      state.pendingPrompt = undefined
      setPendingPromptTaskIds((prev) => {
        const next = new Set(prev)
        next.delete(taskId)
        return next
      })
    }
  }, [])

  const getPendingPromptTaskIds = useCallback((): string[] => {
    return Array.from(pendingPromptTaskIdsRef.current)
  }, [])

  // Full reset for mode switches - removes all state so fresh state is created
  // Sequence numbers handle ordering - no need for ignore mechanism
  const resetTaskState = useCallback((taskId: string): void => {
    statesRef.current.delete(taskId)
    setPendingPromptTaskIds((prev) => {
      const next = new Set(prev)
      next.delete(taskId)
      return next
    })
  }, [])

  // Clean up all memory for a task (call when PTY exits or task is deleted)
  const cleanupTask = useCallback((taskId: string): void => {
    statesRef.current.delete(taskId)
    dataSubsRef.current.delete(taskId)
    exitSubsRef.current.delete(taskId)
    sessionInvalidSubsRef.current.delete(taskId)
    idleSubsRef.current.delete(taskId)
    stateSubsRef.current.delete(taskId)
    promptSubsRef.current.delete(taskId)
    sessionDetectedSubsRef.current.delete(taskId)
    setPendingPromptTaskIds((prev) => {
      const next = new Set(prev)
      next.delete(taskId)
      return next
    })
  }, [])

  // Quick run prompt - for auto-sending prompt when task opens
  const setQuickRunPrompt = useCallback((taskId: string, prompt: string, codeMode?: CodeMode): void => {
    const state = getOrCreateState(taskId)
    state.quickRunPrompt = prompt
    state.quickRunCodeMode = codeMode
  }, [getOrCreateState])

  const getQuickRunPrompt = useCallback((taskId: string): string | undefined => {
    return statesRef.current.get(taskId)?.quickRunPrompt
  }, [])

  const getQuickRunCodeMode = useCallback((taskId: string): CodeMode | undefined => {
    return statesRef.current.get(taskId)?.quickRunCodeMode
  }, [])

  const clearQuickRunPrompt = useCallback((taskId: string): void => {
    const state = statesRef.current.get(taskId)
    if (state) {
      state.quickRunPrompt = undefined
      state.quickRunCodeMode = undefined
    }
  }, [])

  const value = useMemo<PtyContextValue>(() => ({
    subscribe,
    subscribeExit,
    subscribeSessionInvalid,
    subscribeIdle,
    subscribeState,
    subscribePrompt,
    subscribeSessionDetected,
    getLastSeq,
    getExitCode,
    isSessionInvalid,
    getState,
    getPendingPrompt,
    clearPendingPrompt,
    resetTaskState,
    cleanupTask,
    getPendingPromptTaskIds,
    setQuickRunPrompt,
    getQuickRunPrompt,
    getQuickRunCodeMode,
    clearQuickRunPrompt
  }), [
    subscribe,
    subscribeExit,
    subscribeSessionInvalid,
    subscribeIdle,
    subscribeState,
    subscribePrompt,
    subscribeSessionDetected,
    getLastSeq,
    getExitCode,
    isSessionInvalid,
    getState,
    getPendingPrompt,
    clearPendingPrompt,
    resetTaskState,
    cleanupTask,
    getPendingPromptTaskIds,
    setQuickRunPrompt,
    getQuickRunPrompt,
    getQuickRunCodeMode,
    clearQuickRunPrompt
  ])

  return <PtyContext.Provider value={value}>{children}</PtyContext.Provider>
}

export function usePty(): PtyContextValue {
  const ctx = useContext(PtyContext)
  if (!ctx) {
    throw new Error('usePty must be used within PtyProvider')
  }
  return ctx
}

/**
 * Hook for tracking pending prompts globally.
 * Returns array of task IDs with pending prompts.
 */
export function usePendingPrompts(): string[] {
  const ctx = usePty()
  return ctx.getPendingPromptTaskIds()
}
