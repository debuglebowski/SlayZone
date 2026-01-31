/**
 * Tests for ClaudeAdapter activity detection
 * Run with: npx tsx packages/domains/terminal/src/main/adapters/claude-adapter.test.ts
 */
import { ClaudeAdapter } from './claude-adapter'

const adapter = new ClaudeAdapter()

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`✓ ${name}`)
  } catch (e) {
    console.log(`✗ ${name}`)
    console.error(`  ${e}`)
    process.exitCode = 1
  }
}

function expect(actual: unknown) {
  return {
    toBe(expected: unknown) {
      if (actual !== expected) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
    },
    toEqual(expected: unknown) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
      }
    }
  }
}

console.log('\nClaudeAdapter.detectActivity\n')

test('detects numbered menu as awaiting_input', () => {
  const data = `Would you like to proceed?
❯ 1. Yes, clear context and bypass permissions
  2. Yes, and bypass permissions
  3. Yes, manually approve edits`
  expect(adapter.detectActivity(data, 'idle')).toBe('awaiting_input')
})

test('detects numbered menu with ANSI codes', () => {
  const data = `\x1b[1mWould you like to proceed?\x1b[0m
\x1b[32m❯ 1.\x1b[0m Yes, clear context
  2. No`
  expect(adapter.detectActivity(data, 'idle')).toBe('awaiting_input')
})

test('detects Y/n prompt as awaiting_input', () => {
  expect(adapter.detectActivity('Allow this action? [Y/n]', 'idle')).toBe('awaiting_input')
  expect(adapter.detectActivity('Continue? [y/N]', 'idle')).toBe('awaiting_input')
})

test('awaiting_input takes priority over spinner', () => {
  const data = `· Processing...
❯ 1. Yes
  2. No`
  expect(adapter.detectActivity(data, 'idle')).toBe('awaiting_input')
})

test('detects spinner as working', () => {
  expect(adapter.detectActivity('· Thinking...', 'idle')).toBe('working')
  expect(adapter.detectActivity('✻ Clauding...', 'idle')).toBe('working')
})

test('detects idle prompt', () => {
  expect(adapter.detectActivity('\n❯ ', 'working')).toBe('idle')
  expect(adapter.detectActivity('❯ ', 'working')).toBe('idle')
  // Also support regular > for compatibility
  expect(adapter.detectActivity('\n> ', 'working')).toBe('idle')
})

test('idle prompt does not match numbered menu', () => {
  const data = '❯ 1. Yes'
  expect(adapter.detectActivity(data, 'working')).toBe('awaiting_input')
})

test('returns null for unrecognized output', () => {
  expect(adapter.detectActivity('Some random text', 'idle')).toBe(null)
})

console.log('\nClaudeAdapter.detectPrompt\n')

test('detects Y/n as permission prompt', () => {
  const result = adapter.detectPrompt('Allow? [Y/n]')
  expect(result?.type).toBe('permission')
})

test('detects numbered menu as input prompt', () => {
  const data = `Choose:
❯ 1. Option A
  2. Option B`
  const result = adapter.detectPrompt(data)
  expect(result?.type).toBe('input')
})

test('detects question', () => {
  const result = adapter.detectPrompt('What file should I edit?')
  expect(result?.type).toBe('question')
})

console.log('\nDone\n')
