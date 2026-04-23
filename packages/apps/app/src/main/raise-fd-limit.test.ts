/**
 * Tests for raiseFdLimitWith — pure decision logic around RLIMIT_NOFILE.
 * Run with: npx tsx packages/apps/app/src/main/raise-fd-limit.test.ts
 */
import { raiseFdLimitWith, FD_LIMIT_TARGET_SOFT, type PosixModule } from './raise-fd-limit'

let passed = 0
let failed = 0

function test(name: string, fn: () => void): void {
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

function eq<T>(actual: T, expected: T, label?: string): void {
  if (actual !== expected) {
    throw new Error(`${label ? label + ': ' : ''}expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

function mockPosix(initial: { soft: number | null; hard: number | null }, opts: { setrlimitThrows?: boolean } = {}): PosixModule & { lastSet?: { soft?: number | null; hard?: number | null } } {
  const state = { ...initial }
  const mod: PosixModule & { lastSet?: { soft?: number | null; hard?: number | null } } = {
    getrlimit: () => ({ soft: state.soft, hard: state.hard }),
    setrlimit: (_, limits) => {
      if (opts.setrlimitThrows) throw new Error('setrlimit: permission denied')
      mod.lastSet = limits
      if (typeof limits.soft === 'number') state.soft = limits.soft
      else if (limits.soft === null) state.soft = null
      if (typeof limits.hard === 'number') state.hard = limits.hard
      else if (limits.hard === null) state.hard = null
    }
  }
  return mod
}

console.log('\nraiseFdLimitWith')
console.log('─'.repeat(40))

test('win32 — no-op, returns windows-unsupported', () => {
  const r = raiseFdLimitWith(() => { throw new Error('should not be called') }, 'win32')
  eq(r.ok, true)
  eq(r.raised, false)
  eq(r.reason, 'windows-unsupported')
})

test('posix load failure — returns load-failed', () => {
  const r = raiseFdLimitWith(() => { throw new Error('native bindings missing') }, 'darwin')
  eq(r.ok, false)
  eq(r.raised, false)
  if (!r.reason?.startsWith('load-failed')) throw new Error(`expected load-failed reason, got ${r.reason}`)
})

test('soft already high (== target) — no raise, reason=already-high', () => {
  const posix = mockPosix({ soft: FD_LIMIT_TARGET_SOFT, hard: FD_LIMIT_TARGET_SOFT })
  const r = raiseFdLimitWith(() => posix, 'darwin')
  eq(r.ok, true)
  eq(r.raised, false)
  eq(r.reason, 'already-high')
  eq(posix.lastSet, undefined, 'setrlimit should not be called')
})

test('soft already above target — no raise, soft preserved', () => {
  const posix = mockPosix({ soft: 100000, hard: null })
  const r = raiseFdLimitWith(() => posix, 'darwin')
  eq(r.raised, false)
  eq(r.soft, 100000)
  eq(r.hard, 'unlimited')
  eq(posix.lastSet, undefined)
})

test('soft=unlimited (null) — treated as infinity, no raise', () => {
  const posix = mockPosix({ soft: null, hard: null })
  const r = raiseFdLimitWith(() => posix, 'darwin')
  eq(r.raised, false)
  eq(r.soft, 'unlimited')
  eq(r.reason, 'already-high')
  eq(posix.lastSet, undefined)
})

test('soft=256 hard=unlimited (macOS default) — raises soft to target, hard preserved', () => {
  const posix = mockPosix({ soft: 256, hard: null })
  const r = raiseFdLimitWith(() => posix, 'darwin')
  eq(r.ok, true)
  eq(r.raised, true)
  eq(r.soft, FD_LIMIT_TARGET_SOFT)
  eq(r.hard, 'unlimited')
  eq(posix.lastSet?.soft, FD_LIMIT_TARGET_SOFT)
  eq(posix.lastSet?.hard, null, 'hard should be preserved (null = unlimited)')
})

test('soft=1024 hard=4096 — raises soft but may be clamped by hard', () => {
  // The mock does not enforce kernel clamping, so soft just takes the new
  // value. In production, the kernel would clamp to hard. This test just
  // confirms we do not attempt to change hard here.
  const posix = mockPosix({ soft: 1024, hard: 4096 })
  const r = raiseFdLimitWith(() => posix, 'darwin')
  eq(r.raised, true)
  eq(posix.lastSet?.hard, 4096, 'hard should be passed through unchanged')
})

test('setrlimit throws (EPERM) — returns setrlimit-failed reason', () => {
  const posix = mockPosix({ soft: 256, hard: 256 }, { setrlimitThrows: true })
  const r = raiseFdLimitWith(() => posix, 'darwin')
  eq(r.ok, false)
  eq(r.raised, false)
  if (!r.reason?.startsWith('setrlimit-failed')) throw new Error(`expected setrlimit-failed reason, got ${r.reason}`)
})

console.log('\n' + '─'.repeat(40))
console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
