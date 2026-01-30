import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useCallback,
  useState,
  type ReactNode
} from 'react'
import type { TerminalState, PromptInfo } from '../../../../../shared/types/api'

// 300KB buffer limit per task
const MAX_BUFFER_SIZE = 300 * 1024

export type CodeMode = 'normal' | 'plan' | 'accept-edits' | 'bypass'

interface PtyState {
  buffer: string
  exitCode?: number
  sessionInvalid: boolean
  state: TerminalState
  pendingPrompt?: PromptInfo
  quickRunPrompt?: string
  quickRunCodeMode?: CodeMode
}

type DataCallback = (data: string) => void
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
  getBuffer: (taskId: string) => string
  getExitCode: (taskId: string) => number | undefined
  isSessionInvalid: (taskId: string) => boolean
  getState: (taskId: string) => TerminalState
  getPendingPrompt: (taskId: string) => PromptInfo | undefined
  clearPendingPrompt: (taskId: string) => void
  clearBuffer: (taskId: string) => void
  resetTaskState: (taskId: string) => void
  clearIgnore: (taskId: string) => void
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
  // Per-taskId state (buffer, exitCode, sessionInvalid)
  const statesRef = useRef<Map<string, PtyState>>(new Map())

  // Tasks being reset - ignore incoming data for these
  const ignoredTasksRef = useRef<Set<string>>(new Set())

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

  const getOrCreateState = useCallback((taskId: string): PtyState => {
    let state = statesRef.current.get(taskId)
    if (!state) {
      state = { buffer: '', sessionInvalid: false, state: 'starting' }
      statesRef.current.set(taskId, state)
    }
    return state
  }, [])

  // Global listeners - survive all view changes
  useEffect(() => {
    const unsubData = window.api.pty.onData((taskId, data) => {
      // Ignore data for tasks being reset (prevents stale data from recreating state)
      if (ignoredTasksRef.current.has(taskId)) {
        return
      }

      const state = getOrCreateState(taskId)
      state.buffer += data
      if (state.buffer.length > MAX_BUFFER_SIZE) {
        // Prepend ANSI reset in case truncation cuts mid-sequence
        state.buffer = '\x1b[0m' + state.buffer.slice(-MAX_BUFFER_SIZE)
      }

      // Notify subscribers
      const subs = dataSubsRef.current.get(taskId)
      if (subs) {
        subs.forEach((cb) => cb(data))
      }
    })

    const unsubExit = window.api.pty.onExit((taskId, exitCode) => {
      const state = getOrCreateState(taskId)
      state.exitCode = exitCode

      const subs = exitSubsRef.current.get(taskId)
      if (subs) {
        subs.forEach((cb) => cb(exitCode))
      }
    })

    const unsubSessionNotFound = window.api.pty.onSessionNotFound((taskId) => {
      const state = getOrCreateState(taskId)
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
      const state = getOrCreateState(taskId)
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
      const state = getOrCreateState(taskId)
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
    let subs = dataSubsRef.current.get(taskId)
    if (!subs) {
      subs = new Set()
      dataSubsRef.current.set(taskId, subs)
    }
    subs.add(cb)
    return () => {
      subs!.delete(cb)
    }
  }, [])

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
    return () => {
      subs!.delete(cb)
    }
  }, [])

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

  const getBuffer = useCallback((taskId: string): string => {
    return statesRef.current.get(taskId)?.buffer ?? ''
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
    return Array.from(pendingPromptTaskIds)
  }, [pendingPromptTaskIds])

  const clearBuffer = useCallback((taskId: string): void => {
    const state = statesRef.current.get(taskId)
    if (state) {
      state.buffer = ''
    }
  }, [])

  // Clear ignore flag early - call after new PTY is confirmed created
  const clearIgnore = useCallback((taskId: string): void => {
    ignoredTasksRef.current.delete(taskId)
  }, [])

  // Full reset for mode switches - removes all state so fresh state is created
  const resetTaskState = useCallback((taskId: string): void => {
    // Mark as ignored to prevent in-flight IPC data from recreating state
    ignoredTasksRef.current.add(taskId)
    statesRef.current.delete(taskId)
    setPendingPromptTaskIds((prev) => {
      const next = new Set(prev)
      next.delete(taskId)
      return next
    })
    // Clear ignore flag after delay (allows new PTY to start fresh)
    setTimeout(() => {
      ignoredTasksRef.current.delete(taskId)
    }, 500)
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

  const value: PtyContextValue = {
    subscribe,
    subscribeExit,
    subscribeSessionInvalid,
    subscribeIdle,
    subscribeState,
    subscribePrompt,
    subscribeSessionDetected,
    getBuffer,
    getExitCode,
    isSessionInvalid,
    getState,
    getPendingPrompt,
    clearPendingPrompt,
    clearBuffer,
    resetTaskState,
    clearIgnore,
    getPendingPromptTaskIds,
    setQuickRunPrompt,
    getQuickRunPrompt,
    getQuickRunCodeMode,
    clearQuickRunPrompt
  }

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
