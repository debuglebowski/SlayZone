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

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exitCode = 1
