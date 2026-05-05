/**
 * chat-model unit tests
 * Run with: pnpm tsx packages/domains/terminal/src/shared/chat-model.test.ts
 */
import { chatModelToFlags, isChatModel, CHAT_MODELS, DEFAULT_CHAT_MODEL, normalizeAccountModel, FALLBACK_ACCOUNT_DEFAULT_MODEL } from './chat-model.js'

let passed = 0
let failed = 0
function test(name: string, fn: () => void) {
  try { fn(); console.log(`  ✓ ${name}`); passed++ }
  catch (e) { console.error(`  ✗ ${name}\n    ${e}`); failed++ }
}
function expect<T>(v: T) {
  return {
    toBe(e: T) { if (v !== e) throw new Error(`expected ${JSON.stringify(e)}, got ${JSON.stringify(v)}`) },
    toEqual(e: unknown) {
      if (JSON.stringify(v) !== JSON.stringify(e)) throw new Error(`expected ${JSON.stringify(e)}, got ${JSON.stringify(v)}`)
    },
  }
}

console.log('\nchat-model\n')

test('default emits no flags (CLI inherits account default)', () => {
  expect(chatModelToFlags('default')).toEqual([])
})

test('sonnet emits --model sonnet', () => {
  expect(chatModelToFlags('sonnet')).toEqual(['--model', 'sonnet'])
})

test('opus emits --model opus', () => {
  expect(chatModelToFlags('opus')).toEqual(['--model', 'opus'])
})

test('haiku emits --model haiku', () => {
  expect(chatModelToFlags('haiku')).toEqual(['--model', 'haiku'])
})

test('isChatModel accepts known aliases', () => {
  for (const m of CHAT_MODELS) expect(isChatModel(m)).toBe(true)
})

test('isChatModel rejects unknown strings', () => {
  expect(isChatModel('gpt-5')).toBe(false)
  expect(isChatModel('claude-sonnet-4-5')).toBe(false)
  expect(isChatModel('')).toBe(false)
})

test('isChatModel rejects non-strings', () => {
  expect(isChatModel(null)).toBe(false)
  expect(isChatModel(undefined)).toBe(false)
  expect(isChatModel(42)).toBe(false)
  expect(isChatModel({})).toBe(false)
})

test('DEFAULT_CHAT_MODEL is the no-op default', () => {
  expect(DEFAULT_CHAT_MODEL).toBe('default')
  expect(chatModelToFlags(DEFAULT_CHAT_MODEL)).toEqual([])
})

test('normalizeAccountModel: short aliases', () => {
  expect(normalizeAccountModel('opus')).toBe('opus')
  expect(normalizeAccountModel('sonnet')).toBe('sonnet')
  expect(normalizeAccountModel('haiku')).toBe('haiku')
})

test('normalizeAccountModel: full ids', () => {
  expect(normalizeAccountModel('claude-opus-4-7')).toBe('opus')
  expect(normalizeAccountModel('claude-sonnet-4-6')).toBe('sonnet')
  expect(normalizeAccountModel('claude-3-5-sonnet-20241022')).toBe('sonnet')
  expect(normalizeAccountModel('claude-haiku-4-5-20251001')).toBe('haiku')
})

test('normalizeAccountModel: mixed case', () => {
  expect(normalizeAccountModel('Claude-Opus-4-7')).toBe('opus')
  expect(normalizeAccountModel('SONNET')).toBe('sonnet')
})

test('normalizeAccountModel: unknown / null / empty → fallback opus', () => {
  expect(normalizeAccountModel(null)).toBe(FALLBACK_ACCOUNT_DEFAULT_MODEL)
  expect(normalizeAccountModel(undefined)).toBe(FALLBACK_ACCOUNT_DEFAULT_MODEL)
  expect(normalizeAccountModel('')).toBe(FALLBACK_ACCOUNT_DEFAULT_MODEL)
  expect(normalizeAccountModel('gpt-5')).toBe(FALLBACK_ACCOUNT_DEFAULT_MODEL)
  expect(normalizeAccountModel('unknown-future-model')).toBe(FALLBACK_ACCOUNT_DEFAULT_MODEL)
})

test('FALLBACK_ACCOUNT_DEFAULT_MODEL is opus', () => {
  expect(FALLBACK_ACCOUNT_DEFAULT_MODEL).toBe('opus')
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
