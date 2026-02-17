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

test('detects numbered menu as attention', () => {
  const data = `Would you like to proceed?
❯ 1. Yes, clear context and bypass permissions
  2. Yes, and bypass permissions
  3. Yes, manually approve edits`
  expect(adapter.detectActivity(data, 'attention')).toBe('attention')
})

test('detects numbered menu with ANSI codes', () => {
  const data = `\x1b[1mWould you like to proceed?\x1b[0m
\x1b[32m❯ 1.\x1b[0m Yes, clear context
  2. No`
  expect(adapter.detectActivity(data, 'attention')).toBe('attention')
})

test('detects Y/n prompt as attention', () => {
  expect(adapter.detectActivity('Allow this action? [Y/n]', 'attention')).toBe('attention')
  expect(adapter.detectActivity('Continue? [y/N]', 'attention')).toBe('attention')
})

test('attention takes priority over spinner', () => {
  const data = `· Processing...
❯ 1. Yes
  2. No`
  expect(adapter.detectActivity(data, 'attention')).toBe('attention')
})

test('detects spinner as working', () => {
  expect(adapter.detectActivity('· Thinking...', 'attention')).toBe('working')
  expect(adapter.detectActivity('✻ Clauding...', 'attention')).toBe('working')
})

test('detects completion summary as attention (not working)', () => {
  expect(adapter.detectActivity('✻ Worked for 1m 51s', 'working')).toBe('attention')
  expect(adapter.detectActivity('· Ran for 30s', 'working')).toBe('attention')
  expect(adapter.detectActivity('✻ Thinking for 2m', 'working')).toBe('attention')
})

test('detects prompt as attention', () => {
  expect(adapter.detectActivity('\n❯ ', 'working')).toBe('attention')
  expect(adapter.detectActivity('❯ ', 'working')).toBe('attention')
})

test('does not match markdown blockquote as prompt', () => {
  // > in markdown blockquotes should NOT trigger attention
  expect(adapter.detectActivity('\n> Some quoted text', 'working')).toBe(null)
  expect(adapter.detectActivity('> blockquote', 'working')).toBe(null)
})

test('prompt with number is still attention', () => {
  const data = '❯ 1. Yes'
  expect(adapter.detectActivity(data, 'working')).toBe('attention')
})

test('returns null for unrecognized output', () => {
  expect(adapter.detectActivity('Some random text', 'attention')).toBe(null)
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
