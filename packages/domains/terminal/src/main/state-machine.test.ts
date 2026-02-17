/**
 * Tests for StateMachine (terminal state transitions + debounce)
 * Run with: npx tsx packages/domains/terminal/src/main/state-machine.test.ts
 */
import { StateMachine, activityToTerminalState } from './state-machine'
import type { TerminalState } from '@slayzone/terminal/shared'

let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (e) {
    console.log(`  ✗ ${name}`)
    console.error(`    ${e}`)
    failed++
  }
}

function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      if (actual !== expected) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
    },
    toEqual(expected: T) {
      if (JSON.stringify(actual) !== JSON.stringify(expected))
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
    }
  }
}

// Fake timers
let pendingTimers: { id: number; fn: () => void; delay: number; scheduledAt: number }[] = []
let now = 0
let nextId = 1
const realSetTimeout = globalThis.setTimeout
const realClearTimeout = globalThis.clearTimeout

function useFakeTimers() {
  now = 0
  pendingTimers = []
  nextId = 1
  // @ts-expect-error — replacing global setTimeout with fake
  globalThis.setTimeout = (fn: () => void, delay: number) => {
    const id = nextId++
    pendingTimers.push({ id, fn, delay, scheduledAt: now })
    return id
  }
  // @ts-expect-error — replacing global clearTimeout with fake
  globalThis.clearTimeout = (id: number) => {
    pendingTimers = pendingTimers.filter(t => t.id !== id)
  }
}

function advanceTimersByTime(ms: number) {
  const target = now + ms
  while (true) {
    // Find next timer that would fire within target
    const next = pendingTimers
      .filter(t => t.scheduledAt + t.delay <= target)
      .sort((a, b) => (a.scheduledAt + a.delay) - (b.scheduledAt + b.delay))[0]
    if (!next) break
    now = next.scheduledAt + next.delay
    pendingTimers = pendingTimers.filter(t => t.id !== next.id)
    next.fn()
  }
  now = target
}

function useRealTimers() {
  globalThis.setTimeout = realSetTimeout
  globalThis.clearTimeout = realClearTimeout
}

// --- Tests ---

console.log('\nStateMachine.transition\n')

test('running transition is immediate', () => {
  useFakeTimers()
  const changes: [string, TerminalState, TerminalState][] = []
  const sm = new StateMachine((id, n, o) => changes.push([id, n, o]))
  sm.register('s1', 'attention')

  sm.transition('s1', 'running')

  expect(changes.length).toBe(1)
  expect(changes[0]).toEqual(['s1', 'running', 'attention'])
  expect(sm.getState('s1')).toBe('running')
  sm.dispose()
  useRealTimers()
})

test('attention transition is debounced (not immediate)', () => {
  useFakeTimers()
  const changes: [string, TerminalState, TerminalState][] = []
  const sm = new StateMachine((id, n, o) => changes.push([id, n, o]))
  sm.register('s1', 'running')

  sm.transition('s1', 'attention')

  expect(changes.length).toBe(0)  // not yet
  expect(sm.getState('s1')).toBe('running')  // still running
  sm.dispose()
  useRealTimers()
})

test('running→attention debounces at 500ms', () => {
  useFakeTimers()
  const changes: [string, TerminalState, TerminalState][] = []
  const sm = new StateMachine((id, n, o) => changes.push([id, n, o]))
  sm.register('s1', 'running')

  sm.transition('s1', 'attention')

  advanceTimersByTime(99)
  expect(changes.length).toBe(0)

  advanceTimersByTime(300)  // now at 399ms
  expect(changes.length).toBe(0)

  advanceTimersByTime(101)  // now at 500ms
  expect(changes.length).toBe(1)
  expect(changes[0]).toEqual(['s1', 'attention', 'running'])
  sm.dispose()
  useRealTimers()
})

test('running→attention cancelled if running detected within 500ms', () => {
  useFakeTimers()
  const changes: [string, TerminalState, TerminalState][] = []
  const sm = new StateMachine((id, n, o) => changes.push([id, n, o]))
  sm.register('s1', 'running')

  sm.transition('s1', 'attention')
  advanceTimersByTime(200)
  expect(changes.length).toBe(0)

  // Spinner detected again — cancel pending attention
  sm.transition('s1', 'running')
  expect(changes.length).toBe(0)  // already running, no-op
  expect(sm.getState('s1')).toBe('running')

  // Let original timer window pass — should NOT fire
  advanceTimersByTime(500)
  expect(changes.length).toBe(0)
  sm.dispose()
  useRealTimers()
})

test('rapid flicker: running→attention→running→attention settles correctly', () => {
  useFakeTimers()
  const changes: [string, TerminalState, TerminalState][] = []
  const sm = new StateMachine((id, n, o) => changes.push([id, n, o]))
  sm.register('s1', 'running')

  // Flicker cycle 1
  sm.transition('s1', 'attention')
  advanceTimersByTime(100)
  sm.transition('s1', 'running')  // cancel pending attention
  advanceTimersByTime(50)

  // Flicker cycle 2
  sm.transition('s1', 'attention')
  advanceTimersByTime(100)
  sm.transition('s1', 'running')  // cancel again
  advanceTimersByTime(50)

  // Flicker cycle 3
  sm.transition('s1', 'attention')
  advanceTimersByTime(100)
  sm.transition('s1', 'running')  // cancel again

  // No state changes should have occurred (stayed running the whole time)
  expect(changes.length).toBe(0)

  // Now truly idle — attention sticks
  sm.transition('s1', 'attention')
  advanceTimersByTime(500)
  expect(changes.length).toBe(1)
  expect(changes[0]).toEqual(['s1', 'attention', 'running'])
  sm.dispose()
  useRealTimers()
})

test('same-state transition is no-op', () => {
  useFakeTimers()
  const changes: [string, TerminalState, TerminalState][] = []
  const sm = new StateMachine((id, n, o) => changes.push([id, n, o]))
  sm.register('s1', 'running')

  sm.transition('s1', 'running')
  advanceTimersByTime(1000)

  expect(changes.length).toBe(0)
  sm.dispose()
  useRealTimers()
})

test('error transition debounces at 100ms (not 500ms)', () => {
  useFakeTimers()
  const changes: [string, TerminalState, TerminalState][] = []
  const sm = new StateMachine((id, n, o) => changes.push([id, n, o]))
  sm.register('s1', 'running')

  sm.transition('s1', 'error')

  advanceTimersByTime(99)
  expect(changes.length).toBe(0)

  advanceTimersByTime(1)  // at 100ms
  expect(changes.length).toBe(1)
  expect(changes[0]).toEqual(['s1', 'error', 'running'])
  sm.dispose()
  useRealTimers()
})

test('dead transition debounces at 100ms', () => {
  useFakeTimers()
  const changes: [string, TerminalState, TerminalState][] = []
  const sm = new StateMachine((id, n, o) => changes.push([id, n, o]))
  sm.register('s1', 'attention')

  sm.transition('s1', 'dead')

  advanceTimersByTime(99)
  expect(changes.length).toBe(0)

  advanceTimersByTime(1)
  expect(changes.length).toBe(1)
  expect(changes[0]).toEqual(['s1', 'dead', 'attention'])
  sm.dispose()
  useRealTimers()
})

test('attention→attention (non-running source) debounces at 100ms', () => {
  useFakeTimers()
  const changes: [string, TerminalState, TerminalState][] = []
  const sm = new StateMachine((id, n, o) => changes.push([id, n, o]))
  sm.register('s1', 'starting')

  sm.transition('s1', 'attention')

  advanceTimersByTime(99)
  expect(changes.length).toBe(0)

  advanceTimersByTime(1)  // at 100ms
  expect(changes.length).toBe(1)
  expect(changes[0]).toEqual(['s1', 'attention', 'starting'])
  sm.dispose()
  useRealTimers()
})

test('unregistered session is no-op', () => {
  useFakeTimers()
  const changes: [string, TerminalState, TerminalState][] = []
  const sm = new StateMachine((id, n, o) => changes.push([id, n, o]))

  sm.transition('nope', 'running')
  advanceTimersByTime(1000)

  expect(changes.length).toBe(0)
  sm.dispose()
  useRealTimers()
})

test('new transition replaces pending timer', () => {
  useFakeTimers()
  const changes: [string, TerminalState, TerminalState][] = []
  const sm = new StateMachine((id, n, o) => changes.push([id, n, o]))
  sm.register('s1', 'running')

  sm.transition('s1', 'attention')  // starts 500ms timer
  advanceTimersByTime(400)

  sm.transition('s1', 'error')  // replaces with 100ms timer
  advanceTimersByTime(100)

  expect(changes.length).toBe(1)
  expect(changes[0]).toEqual(['s1', 'error', 'running'])
  sm.dispose()
  useRealTimers()
})

console.log('\nactivityToTerminalState\n')

test('working → running', () => {
  expect(activityToTerminalState('working')).toBe('running')
})

test('attention → attention', () => {
  expect(activityToTerminalState('attention')).toBe('attention')
})

test('unknown → null', () => {
  expect(activityToTerminalState('unknown')).toBe(null)
})

// Summary
console.log(`\n${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exitCode = 1
