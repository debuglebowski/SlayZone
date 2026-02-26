/**
 * Desktop handoff matcher contract tests
 * Run with: npx tsx packages/domains/task/src/shared/handoff.test.ts
 */
import {
  inferHostScopeFromUrl,
  inferProtocolFromUrl,
  isBlockedExternalHandoffUrl,
  isBlockedExternalProtocolUrl,
  isEncodedDesktopHandoffUrl,
  isLoopbackUrl,
  isUrlWithinHostScope,
  normalizeDesktopProtocol,
} from './handoff.js'

let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`✓ ${name}`)
    passed++
  } catch (error) {
    console.log(`✗ ${name}`)
    console.error(`  ${error instanceof Error ? error.message : String(error)}`)
    failed++
  }
}

function expect(actual: unknown) {
  return {
    toBe(expected: unknown) {
      if (actual !== expected) throw new Error(`Expected ${String(actual)} to be ${String(expected)}`)
    },
  }
}

test('blocks direct external protocol URLs', () => {
  expect(isBlockedExternalProtocolUrl('figma://open')).toBe(true)
  expect(isBlockedExternalProtocolUrl('slack://channel?id=abc')).toBe(true)
})

test('blocks encoded desktop handoff URLs for configured protocol', () => {
  expect(
    isEncodedDesktopHandoffUrl('https://www.figma.com/exit?url=figma%3A%2F%2Fopen', {
      protocol: 'figma',
      hostScope: 'figma.com',
    })
  ).toBe(true)
  expect(
    isEncodedDesktopHandoffUrl('https://www.figma.com/file/123?target=figma%3A%2F%2Fopen', {
      protocol: 'figma',
      hostScope: 'figma.com',
    })
  ).toBe(true)
})

test('does not block normal figma auth or web URLs', () => {
  expect(
    isEncodedDesktopHandoffUrl('https://www.figma.com/oauth/authorize?client_id=test', {
      protocol: 'figma',
      hostScope: 'figma.com',
    })
  ).toBe(false)
  expect(
    isEncodedDesktopHandoffUrl('https://www.figma.com/design/abc', {
      protocol: 'figma',
      hostScope: 'figma.com',
    })
  ).toBe(false)
})

test('does not overblock outside host scope', () => {
  expect(
    isEncodedDesktopHandoffUrl('https://accounts.example.com/login?next=slack%3A%2F%2Fopen', {
      protocol: 'slack',
      hostScope: 'slack.com',
    })
  ).toBe(false)
})

test('does not match encoded handoff URLs when no explicit policy is provided', () => {
  expect(isEncodedDesktopHandoffUrl('https://www.figma.com/exit?url=figma%3A%2F%2Fopen')).toBe(false)
})

test('combined matcher keeps direct protocol + encoded behavior', () => {
  expect(isBlockedExternalHandoffUrl('figma://open')).toBe(true)
  expect(
    isBlockedExternalHandoffUrl('https://www.figma.com/exit?url=figma%3A%2F%2Fopen', {
      protocol: 'figma',
      hostScope: 'figma.com',
    })
  ).toBe(true)
  expect(
    isBlockedExternalHandoffUrl('https://www.figma.com/oauth/authorize?client_id=test', {
      protocol: 'figma',
      hostScope: 'figma.com',
    })
  ).toBe(false)
})

test('normalization and inference helpers provide sane defaults', () => {
  expect(normalizeDesktopProtocol('Figma://')).toBe('figma')
  expect(inferProtocolFromUrl('https://app.miro.com')).toBe('miro')
  expect(inferHostScopeFromUrl('https://www.figma.com/file/123')).toBe('figma.com')
})

test('host scope matcher accepts same host family only', () => {
  expect(isUrlWithinHostScope('https://www.figma.com/file/123', 'figma.com')).toBe(true)
  expect(isUrlWithinHostScope('https://accounts.figma.com/login', 'figma.com')).toBe(true)
  expect(isUrlWithinHostScope('https://google.com', 'figma.com')).toBe(false)
})

test('loopback matcher identifies localhost bridges', () => {
  expect(isLoopbackUrl('http://127.0.0.1:38495/open')).toBe(true)
  expect(isLoopbackUrl('https://localhost:38495/status')).toBe(true)
  expect(isLoopbackUrl('http://[::1]:38495/ping')).toBe(true)
  expect(isLoopbackUrl('https://www.figma.com')).toBe(false)
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exitCode = 1
