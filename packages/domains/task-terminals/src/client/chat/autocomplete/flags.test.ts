/**
 * Tests for mergeEffortFlag — flag-string merging for `/effort <level>`.
 * Run with: pnpm exec tsx packages/domains/task-terminals/src/client/chat/autocomplete/flags.test.ts
 */
import { mergeEffortFlag } from './flags'

let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (e) {
    console.error(`  ✗ ${name}`)
    console.error(`    ${e instanceof Error ? e.message : e}`)
    failed++
  }
}

function assertEqual<T>(actual: T, expected: T, label?: string): void {
  if (actual !== expected) {
    throw new Error(`${label ?? 'values'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

console.log('\nmergeEffortFlag')

test('null current → inserts --effort + level', () => {
  assertEqual(mergeEffortFlag(null, 'high'), '--effort high')
})

test('empty current → inserts --effort + level', () => {
  assertEqual(mergeEffortFlag('', 'high'), '--effort high')
})

test('current w/ unrelated flags → appends --effort', () => {
  assertEqual(
    mergeEffortFlag('--allow-dangerously-skip-permissions --verbose', 'medium'),
    '--allow-dangerously-skip-permissions --verbose --effort medium'
  )
})

test('replaces existing --effort <level>', () => {
  assertEqual(
    mergeEffortFlag('--effort low --verbose', 'max'),
    '--verbose --effort max'
  )
})

test('replaces --effort surrounded by other flags', () => {
  assertEqual(
    mergeEffortFlag('--allow-dangerously-skip-permissions --effort low --verbose', 'xhigh'),
    '--allow-dangerously-skip-permissions --verbose --effort xhigh'
  )
})

test('handles multiple stale --effort entries (drops all, appends one)', () => {
  assertEqual(
    mergeEffortFlag('--effort low --effort medium --verbose', 'high'),
    '--verbose --effort high'
  )
})

test('trims extra whitespace into single-space separators', () => {
  assertEqual(
    mergeEffortFlag('  --verbose   --something   ', 'low'),
    '--verbose --something --effort low'
  )
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
