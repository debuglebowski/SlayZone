import type { TerminalState } from '@slayzone/terminal/shared'
import type { ActivityState } from './adapters/types'

/** Callback invoked when state actually changes (after debounce) */
export type StateChangeCallback = (sessionId: string, newState: TerminalState, oldState: TerminalState) => void

// Debounce durations (ms)
const DEBOUNCE_RUNNING_TO_ATTENTION = 500
const DEBOUNCE_DEFAULT = 100

interface SessionState {
  state: TerminalState
}

/**
 * Manages terminal state transitions with asymmetric debouncing.
 * - Transitions to 'running' are immediate (show work resuming right away)
 * - Transitions from 'running' to 'attention' debounce 500ms (prevent flicker during output gaps)
 * - Other non-running transitions debounce 100ms
 *
 * No Electron dependencies — pure logic, testable with fake timers.
 */
export class StateMachine {
  private sessions = new Map<string, SessionState>()
  private timers = new Map<string, ReturnType<typeof setTimeout>>()
  private onChange: StateChangeCallback

  constructor(onChange: StateChangeCallback) {
    this.onChange = onChange
  }

  /** Register a session with an initial state */
  register(sessionId: string, initialState: TerminalState): void {
    this.sessions.set(sessionId, { state: initialState })
  }

  /** Remove a session and clear any pending timer */
  unregister(sessionId: string): void {
    this.clearTimer(sessionId)
    this.sessions.delete(sessionId)
  }

  /** Get current state for a session */
  getState(sessionId: string): TerminalState | undefined {
    return this.sessions.get(sessionId)?.state
  }

  /** Request a state transition (debounced per rules above) */
  transition(sessionId: string, newState: TerminalState): void {
    const session = this.sessions.get(sessionId)
    if (!session) return

    this.clearTimer(sessionId)

    if (session.state === newState) return

    if (newState === 'running') {
      // Immediate — show work resuming right away
      const oldState = session.state
      session.state = newState
      this.onChange(sessionId, newState, oldState)
    } else {
      // Debounced — longer delay for running→attention to prevent flicker
      const delay = session.state === 'running' && newState === 'attention'
        ? DEBOUNCE_RUNNING_TO_ATTENTION
        : DEBOUNCE_DEFAULT
      this.timers.set(sessionId, setTimeout(() => {
        this.timers.delete(sessionId)
        const session = this.sessions.get(sessionId)
        if (!session || session.state === newState) return
        const oldState = session.state
        session.state = newState
        this.onChange(sessionId, newState, oldState)
      }, delay))
    }
  }

  /** Update state directly (used by pty-manager for external mutations) */
  setState(sessionId: string, state: TerminalState): void {
    const session = this.sessions.get(sessionId)
    if (session) session.state = state
  }

  /** Clean up all timers */
  dispose(): void {
    for (const timer of this.timers.values()) clearTimeout(timer)
    this.timers.clear()
    this.sessions.clear()
  }

  private clearTimer(sessionId: string): void {
    const pending = this.timers.get(sessionId)
    if (pending) {
      clearTimeout(pending)
      this.timers.delete(sessionId)
    }
  }
}

/** Map ActivityState to TerminalState */
export function activityToTerminalState(activity: ActivityState): TerminalState | null {
  switch (activity) {
    case 'attention':
      return 'attention'
    case 'working':
      return 'running'
    default:
      return null
  }
}
