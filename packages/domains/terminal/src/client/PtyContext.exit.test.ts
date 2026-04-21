/**
 * Regression tests for PtyContext exit handling.
 * Run with: npx tsx packages/domains/terminal/src/client/PtyContext.exit.test.ts
 */
import { applyExitEvent } from './PtyContext'
import type { TerminalState } from '@slayzone/terminal/shared'

let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`✓ ${name}`)
    passed++
  } catch (e) {
    console.log(`✗ ${name}`)
    console.error(`  ${e}`)
    failed++
  }
}

function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      if (actual !== expected) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
      }
    }
  }
}

test('transitions state to dead and notifies state + exit subscribers', () => {
  const stateSubs = new Map<string, Set<(newState: TerminalState, oldState: TerminalState) => void>>()
  const exitSubs = new Map<string, Set<(exitCode: number) => void>>()
  const stateChanges: Array<{ newState: TerminalState; oldState: TerminalState }> = []
  const exits: number[] = []

  stateSubs.set('s1', new Set([(newState, oldState) => stateChanges.push({ newState, oldState })]))
  exitSubs.set('s1', new Set([(exitCode) => exits.push(exitCode)]))

  const state = {
    lastSeq: 12,
    sessionInvalid: false,
    state: 'running' as TerminalState,
    exitCode: undefined as number | undefined,
    crashOutput: undefined as string | undefined
  }
  state.exitCode = 0

  applyExitEvent('s1', 7, state, stateSubs, exitSubs)

  expect(state.state).toBe('dead')
  expect(stateChanges.length).toBe(1)
  expect(stateChanges[0].newState).toBe('dead')
  expect(stateChanges[0].oldState).toBe('running')
  expect(exits.length).toBe(1)
  expect(exits[0]).toBe(7)
})

test('notifies exit subscribers even if local state is missing', () => {
  const stateSubs = new Map<string, Set<(newState: TerminalState, oldState: TerminalState) => void>>()
  const exitSubs = new Map<string, Set<(exitCode: number) => void>>()
  const exits: number[] = []

  exitSubs.set('s2', new Set([(exitCode) => exits.push(exitCode)]))

  applyExitEvent('s2', 0, undefined, stateSubs, exitSubs)

  expect(exits.length).toBe(1)
  expect(exits[0]).toBe(0)
})

test('programmatic kill (PTY_EXIT_KILLED_BY_HOST = -2) produces dead state + exit notify', () => {
  // Guards the fix for GitHub issue #77 on the renderer side: when main dispatches
  // pty:exit with the host-kill sentinel, the same code path runs as a natural exit —
  // state flips to 'dead' and Retry overlay gates open.
  const PTY_EXIT_KILLED_BY_HOST = -2
  const stateSubs = new Map<string, Set<(newState: TerminalState, oldState: TerminalState) => void>>()
  const exitSubs = new Map<string, Set<(exitCode: number) => void>>()
  const stateChanges: Array<{ newState: TerminalState; oldState: TerminalState }> = []
  const exits: number[] = []

  stateSubs.set('killed', new Set([(n, o) => stateChanges.push({ newState: n, oldState: o })]))
  exitSubs.set('killed', new Set([(code) => exits.push(code)]))

  const state = {
    lastSeq: 3,
    sessionInvalid: false,
    state: 'idle' as TerminalState,
    exitCode: undefined as number | undefined,
    crashOutput: undefined as string | undefined
  }

  applyExitEvent('killed', PTY_EXIT_KILLED_BY_HOST, state, stateSubs, exitSubs)

  expect(state.state).toBe('dead')
  expect(stateChanges.length).toBe(1)
  expect(stateChanges[0].newState).toBe('dead')
  expect(stateChanges[0].oldState).toBe('idle')
  expect(exits.length).toBe(1)
  expect(exits[0]).toBe(PTY_EXIT_KILLED_BY_HOST)
})

test('double exit is idempotent — second call does not re-notify state subscribers', () => {
  // The renderer-side applyExitEvent only transitions to 'dead' once; a subsequent
  // pty:exit (e.g. if the 500ms watchdog races with the real onExit) must not
  // re-emit state changes.
  const stateSubs = new Map<string, Set<(newState: TerminalState, oldState: TerminalState) => void>>()
  const exitSubs = new Map<string, Set<(exitCode: number) => void>>()
  const stateChanges: Array<{ newState: TerminalState; oldState: TerminalState }> = []
  const exits: number[] = []

  stateSubs.set('s3', new Set([(n, o) => stateChanges.push({ newState: n, oldState: o })]))
  exitSubs.set('s3', new Set([(code) => exits.push(code)]))

  const state = {
    lastSeq: 0,
    sessionInvalid: false,
    state: 'running' as TerminalState,
    exitCode: undefined as number | undefined,
    crashOutput: undefined as string | undefined
  }

  applyExitEvent('s3', -2, state, stateSubs, exitSubs)
  applyExitEvent('s3', -2, state, stateSubs, exitSubs)

  // Only one state transition since state.state === 'dead' after the first call
  expect(stateChanges.length).toBe(1)
  // Exit subscribers are intentionally notified on every call (same as natural exits)
  expect(exits.length).toBe(2)
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exitCode = 1
