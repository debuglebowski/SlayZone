/**
 * Tests for ChatTransportManager.
 * Run with: pnpm dlx tsx packages/domains/terminal/src/main/chat-transport-manager.test.ts
 */
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import type { ChildProcess } from 'node:child_process'
import * as mgr from './chat-transport-manager'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

let passed = 0
let failed = 0

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn()
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
      if (actual !== expected)
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
    },
    toBeTruthy() {
      if (!actual) throw new Error(`Expected truthy, got ${JSON.stringify(actual)}`)
    },
  }
}

interface FakeChild extends ChildProcess {
  _stdinRef: { value: string }
  _stdout: PassThrough
  _stderr: PassThrough
}
function makeFakeChild(): FakeChild {
  const emitter = new EventEmitter()
  const stdout = new PassThrough()
  const stderr = new PassThrough()
  const stdinRef = { value: '' }
  const stdin = {
    write: (s: string) => {
      stdinRef.value += s
      return true
    },
  }
  const fake = Object.assign(emitter, {
    stdout,
    stderr,
    stdin,
    pid: 99999,
    kill: (_sig?: string) => true,
    _stdinRef: stdinRef,
    _stdout: stdout,
    _stderr: stderr,
  })
  return fake as unknown as FakeChild
}

function fixtureDir(): string {
  return resolve(__dirname, '../../test/fixtures/claude-stream')
}

async function setup() {
  mgr.__resetForTests()
  mgr.resetTransportDeps()
}

console.log('\nChatTransportManager tests\n')

await test('createChat: unknown mode → throws ChatTransportError', async () => {
  await setup()
  let err: Error | null = null
  try {
    await mgr.createChat({
      tabId: 't1',
    taskId: 'task-test',
      mode: 'nonexistent-mode',
      cwd: '/tmp',
      conversationId: null,
      providerFlags: [],
    })
  } catch (e) {
    err = e as Error
  }
  expect(err?.name).toBe('ChatTransportError')
  expect(err?.message.includes('nonexistent-mode')).toBeTruthy()
})

await test('createChat: missing binary → throws ChatTransportError', async () => {
  await setup()
  mgr.setTransportDepsForTests({
    whichBinary: async () => null,
    spawn: () => makeFakeChild() as unknown as ChildProcess,
    broadcastEvent: () => {},
    broadcastExit: () => {},
  })
  let err: Error | null = null
  try {
    await mgr.createChat({
      tabId: 't2',
    taskId: 'task-test',
      mode: 'claude-code',
      cwd: '/tmp',
      conversationId: null,
      providerFlags: [],
    })
  } catch (e) {
    err = e as Error
  }
  expect(err?.message.includes('not found on PATH')).toBeTruthy()
})

await test('createChat: pipes fixture NDJSON → emits typed events + ring buffer populated', async () => {
  await setup()
  const captured: Array<{ tabId: string; kind: string; seq: number }> = []
  const fake = makeFakeChild()
  mgr.setTransportDepsForTests({
    whichBinary: async () => '/fake/claude',
    spawn: () => fake as unknown as ChildProcess,
    broadcastEvent: (tabId, event, seq) => {
      captured.push({ tabId, kind: event.kind, seq })
    },
    broadcastExit: () => {},
  })
  await mgr.createChat({
    tabId: 'tab-x',
    taskId: 'task-test',
    mode: 'claude-code',
    cwd: '/tmp',
    conversationId: null,
    providerFlags: [],
  })
  const raw = readFileSync(resolve(fixtureDir(), 'bash.ndjson'), 'utf8')
  fake._stdout.write(raw)
  await new Promise((r) => setTimeout(r, 50))

  const kinds = captured.map((c) => c.kind)
  expect(kinds.includes('turn-init')).toBeTruthy()
  expect(kinds.includes('tool-call')).toBeTruthy()
  expect(kinds.includes('result')).toBeTruthy()

  const buf = mgr.getEventBufferSince('tab-x', -1)
  expect(buf.length > 0).toBeTruthy()
  expect(buf[0].seq).toBe(0)
  expect(buf[buf.length - 1].seq).toBe(buf.length - 1)
})

await test('getEventBufferSince: returns only events with seq > afterSeq', async () => {
  await setup()
  const fake = makeFakeChild()
  mgr.setTransportDepsForTests({
    whichBinary: async () => '/fake/claude',
    spawn: () => fake as unknown as ChildProcess,
    broadcastEvent: () => {},
    broadcastExit: () => {},
  })
  await mgr.createChat({
    tabId: 'tab-y',
    taskId: 'task-test',
    mode: 'claude-code',
    cwd: '/tmp',
    conversationId: null,
    providerFlags: [],
  })
  fake._stdout.write(readFileSync(resolve(fixtureDir(), 'bash.ndjson'), 'utf8'))
  await new Promise((r) => setTimeout(r, 50))
  const total = mgr.getEventBufferSince('tab-y', -1).length
  const tail = mgr.getEventBufferSince('tab-y', 2)
  expect(tail.length).toBe(total - 3)
  if (tail.length > 0) expect(tail[0].seq).toBe(3)
})

await test('persist callback fires on turn-init', async () => {
  await setup()
  const fake = makeFakeChild()
  mgr.setTransportDepsForTests({
    whichBinary: async () => '/fake/claude',
    spawn: () => fake as unknown as ChildProcess,
    broadcastEvent: () => {},
    broadcastExit: () => {},
  })
  const persisted: string[] = []
  await mgr.createChat({
    tabId: 'tab-z',
    taskId: 'task-test',
    mode: 'claude-code',
    cwd: '/tmp',
    conversationId: null,
    providerFlags: [],
    onPersistSessionId: (id) => persisted.push(id),
  })
  fake._stdout.write(readFileSync(resolve(fixtureDir(), 'bash.ndjson'), 'utf8'))
  await new Promise((r) => setTimeout(r, 50))
  expect(persisted.length > 0).toBeTruthy()
  expect(persisted[0].length > 0).toBeTruthy()
})

await test('sendUserMessage: writes NDJSON line to stdin', async () => {
  await setup()
  const fake = makeFakeChild()
  mgr.setTransportDepsForTests({
    whichBinary: async () => '/fake/claude',
    spawn: () => fake as unknown as ChildProcess,
    broadcastEvent: () => {},
    broadcastExit: () => {},
  })
  await mgr.createChat({
    tabId: 'tab-msg',
    taskId: 'task-test',
    mode: 'claude-code',
    cwd: '/tmp',
    conversationId: null,
    providerFlags: [],
  })
  const ok = mgr.sendUserMessage('tab-msg', 'hello')
  expect(ok).toBe(true)
  const line = fake._stdinRef.value.trim()
  const parsed = JSON.parse(line)
  expect(parsed.type).toBe('user')
  expect(parsed.message.content).toBe('hello')
})

await test('invalid --resume: onInvalidResume fires + auto-retry with fresh session', async () => {
  await setup()
  const persisted: string[] = []
  let invalidResumeCalled = 0
  let spawnCount = 0
  const lastArgs: string[][] = []
  const fakes: Array<ReturnType<typeof makeFakeChild>> = []
  mgr.setTransportDepsForTests({
    whichBinary: async () => '/fake/claude',
    spawn: (_cmd, args) => {
      spawnCount++
      lastArgs.push(args)
      const f = makeFakeChild()
      fakes.push(f)
      return f as unknown as ChildProcess
    },
    broadcastEvent: () => {},
    broadcastExit: () => {},
  })
  await mgr.createChat({
    tabId: 'tab-resume',
    taskId: 'task-test',
    mode: 'claude-code',
    cwd: '/tmp',
    conversationId: 'stale-session-id',
    providerFlags: [],
    onPersistSessionId: (id) => persisted.push(id),
    onInvalidResume: () => invalidResumeCalled++,
  })
  expect(spawnCount).toBe(1)
  expect(lastArgs[0].includes('--resume')).toBe(true)

  // Simulate Claude emitting "No conversation found" stderr + error result.
  const first = fakes[0]
  first._stderr.write('No conversation found with session ID: stale-session-id\n')
  first._stdout.write(
    JSON.stringify({
      type: 'result',
      subtype: 'error_during_execution',
      is_error: true,
      duration_ms: 0,
      duration_api_ms: 0,
      num_turns: 0,
      total_cost_usd: 0,
      result: 'No conversation found with session ID: stale-session-id',
    }) + '\n'
  )
  // Let readline flush + setImmediate fire.
  await new Promise((r) => setTimeout(r, 150))
  // Simulate exit so retry proceeds.
  ;(first as unknown as EventEmitter).emit('exit', 1, null)
  await new Promise((r) => setTimeout(r, 100))

  expect(invalidResumeCalled).toBe(1)
  expect(spawnCount).toBe(2)
  // Second spawn must be fresh session-id, not --resume
  expect(lastArgs[1].includes('--resume')).toBe(false)
  expect(lastArgs[1].includes('--session-id')).toBe(true)
})

await test('exit event: fires process-exit + chat:exit broadcast', async () => {
  await setup()
  const fake = makeFakeChild()
  const eventKinds: string[] = []
  const exits: Array<{ code: number | null; signal: string | null }> = []
  mgr.setTransportDepsForTests({
    whichBinary: async () => '/fake/claude',
    spawn: () => fake as unknown as ChildProcess,
    broadcastEvent: (_tab, event) => eventKinds.push(event.kind),
    broadcastExit: (_tab, _sid, code, signal) => exits.push({ code, signal }),
  })
  await mgr.createChat({
    tabId: 'tab-exit',
    taskId: 'task-test',
    mode: 'claude-code',
    cwd: '/tmp',
    conversationId: null,
    providerFlags: [],
  })
  ;(fake as unknown as EventEmitter).emit('exit', 0, null)
  await new Promise((r) => setTimeout(r, 10))
  expect(eventKinds.includes('process-exit')).toBeTruthy()
  expect(exits.length).toBe(1)
  expect(exits[0].code).toBe(0)
})

await test('exit event: chat:exit broadcast carries dying session sessionId', async () => {
  await setup()
  const fake = makeFakeChild()
  const exits: Array<{ sessionId: string }> = []
  mgr.setTransportDepsForTests({
    whichBinary: async () => '/fake/claude',
    spawn: () => fake as unknown as ChildProcess,
    broadcastEvent: () => {},
    broadcastExit: (_tab, sessionId) => exits.push({ sessionId }),
  })
  const info = await mgr.createChat({
    tabId: 'tab-exit-sid',
    taskId: 'task-test',
    mode: 'claude-code',
    cwd: '/tmp',
    conversationId: 'sid-known',
    providerFlags: [],
  })
  ;(fake as unknown as EventEmitter).emit('exit', 0, null)
  await new Promise((r) => setTimeout(r, 10))
  expect(exits.length).toBe(1)
  expect(exits[0].sessionId).toBe(info.sessionId)
})

await test('reset race: old session exit fires after removeSession — broadcast swallowed', async () => {
  await setup()
  let spawnCount = 0
  const children: FakeChild[] = []
  const events: string[] = []
  const exits: Array<{ code: number | null }> = []
  mgr.setTransportDepsForTests({
    whichBinary: async () => '/fake/claude',
    spawn: () => {
      spawnCount++
      const f = makeFakeChild()
      children.push(f)
      return f as unknown as ChildProcess
    },
    broadcastEvent: (_tab, event) => events.push(event.kind),
    broadcastExit: (_tab, _sid, code) => exits.push({ code }),
    broadcastStateChange: () => {},
  })

  // 1. Spawn session A.
  await mgr.createChat({
    tabId: 'tab-reset',
    taskId: 'task-test',
    mode: 'claude-code',
    cwd: '/tmp',
    conversationId: null,
    providerFlags: [],
  })
  expect(spawnCount).toBe(1)

  // 2. Reset flow: kill + remove + create.
  mgr.kill('tab-reset')
  mgr.removeSession('tab-reset')
  await mgr.createChat({
    tabId: 'tab-reset',
    taskId: 'task-test',
    mode: 'claude-code',
    cwd: '/tmp',
    conversationId: null,
    providerFlags: [],
  })
  expect(spawnCount).toBe(2)

  const beforeExitCount = exits.length

  // 3. Old session A's exit fires LATE — after new session already spawned.
  ;(children[0] as unknown as EventEmitter).emit('exit', 0, null)
  await new Promise((r) => setTimeout(r, 10))

  // Identity guard must have swallowed it — no new exit broadcast.
  expect(exits.length).toBe(beforeExitCount)
  // process-exit event must NOT have been buffered on the new session either.
  // (If it had, eventKinds would include 'process-exit'.)
  expect(events.filter((k) => k === 'process-exit').length).toBe(0)
})

await test('reset race: live session exit (not stale) still broadcasts', async () => {
  await setup()
  const fake = makeFakeChild()
  const events: string[] = []
  const exits: Array<{ code: number | null }> = []
  mgr.setTransportDepsForTests({
    whichBinary: async () => '/fake/claude',
    spawn: () => fake as unknown as ChildProcess,
    broadcastEvent: (_tab, event) => events.push(event.kind),
    broadcastExit: (_tab, _sid, code) => exits.push({ code }),
    broadcastStateChange: () => {},
  })
  await mgr.createChat({
    tabId: 'tab-live',
    taskId: 'task-test',
    mode: 'claude-code',
    cwd: '/tmp',
    conversationId: null,
    providerFlags: [],
  })
  // Session still in map (no reset). Exit fires.
  ;(fake as unknown as EventEmitter).emit('exit', 0, null)
  await new Promise((r) => setTimeout(r, 10))
  expect(exits.length).toBe(1)
  expect(events.includes('process-exit')).toBeTruthy()
})

await test('createChat: same tabId with different (taskId,cwd) → tears down zombie + spawns fresh', async () => {
  await setup()
  const fakeOld = makeFakeChild()
  const fakeNew = makeFakeChild()
  let spawnCount = 0
  let oldKilled = false
  fakeOld.kill = (_sig?: string) => {
    oldKilled = true
    return true
  }
  const events: Array<{ tabId: string; kind: string }> = []
  mgr.setTransportDepsForTests({
    whichBinary: async () => '/fake/claude',
    spawn: () => {
      spawnCount++
      return (spawnCount === 1 ? fakeOld : fakeNew) as unknown as ChildProcess
    },
    broadcastEvent: (tabId, event) => events.push({ tabId, kind: event.kind }),
    broadcastExit: () => {},
    broadcastStateChange: () => {},
  })
  // First create: taskA, cwd /a
  await mgr.createChat({
    tabId: 'shared-tab',
    taskId: 'taskA',
    mode: 'claude-code',
    cwd: '/a',
    conversationId: null,
    providerFlags: [],
  })
  expect(spawnCount).toBe(1)

  // Second create on same tabId but different identity → must tear down + respawn
  await mgr.createChat({
    tabId: 'shared-tab',
    taskId: 'taskB',
    mode: 'claude-code',
    cwd: '/b',
    conversationId: null,
    providerFlags: [],
  })
  expect(spawnCount).toBe(2)
  expect(oldKilled).toBe(true)

  // New session emits events; assert broadcast carries the (now sole) live tabId
  fakeNew._stdout.write(readFileSync(resolve(fixtureDir(), 'bash.ndjson'), 'utf8'))
  await new Promise((r) => setTimeout(r, 30))
  expect(events.some((e) => e.kind === 'turn-init')).toBeTruthy()
})

await test('createChat: same tabId AND same identity → returns existing session (idempotent)', async () => {
  await setup()
  const fake = makeFakeChild()
  let spawnCount = 0
  mgr.setTransportDepsForTests({
    whichBinary: async () => '/fake/claude',
    spawn: () => {
      spawnCount++
      return fake as unknown as ChildProcess
    },
    broadcastEvent: () => {},
    broadcastExit: () => {},
    broadcastStateChange: () => {},
  })
  await mgr.createChat({
    tabId: 'idem-tab',
    taskId: 'taskA',
    mode: 'claude-code',
    cwd: '/a',
    conversationId: null,
    providerFlags: [],
  })
  await mgr.createChat({
    tabId: 'idem-tab',
    taskId: 'taskA',
    mode: 'claude-code',
    cwd: '/a',
    conversationId: null,
    providerFlags: [],
  })
  expect(spawnCount).toBe(1)
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
