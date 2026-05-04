/**
 * Tests for ClaudeCodeAdapter against real fixtures captured in Spike B.
 * Run with: npx tsx packages/domains/terminal/src/main/agents/claude-code-adapter.test.ts
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { claudeCodeAdapter } from './claude-code-adapter'
import type { AgentEvent } from '../../shared/agent-events'

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
      if (actual !== expected)
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
    },
    toBeTruthy() {
      if (!actual) throw new Error(`Expected truthy, got ${JSON.stringify(actual)}`)
    },
    toInclude(substr: string) {
      if (typeof actual !== 'string' || !actual.includes(substr))
        throw new Error(`Expected ${JSON.stringify(actual)} to include ${substr}`)
    },
  }
}

const FIXTURES_DIR = join(
  process.cwd(),
  'packages/domains/terminal/test/fixtures/claude-stream'
)

function parseFixture(name: string): AgentEvent[] {
  const raw = readFileSync(join(FIXTURES_DIR, name), 'utf8')
  const lines = raw.split('\n').filter((l) => l.trim())
  return lines.map((l) => claudeCodeAdapter.parseLine(l)!).filter(Boolean)
}

console.log('\nClaudeCodeAdapter tests\n')

// ---- Fixture-driven coverage ----
const fixtureFiles = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.ndjson'))
for (const f of fixtureFiles) {
  test(`parses ${f} end-to-end (no parse-error events)`, () => {
    const events = parseFixture(f)
    expect(events.length > 0).toBeTruthy()
    const parseErrors = events.filter(
      (e) => e.kind === 'unknown' && e.reason === 'parse-error'
    )
    expect(parseErrors.length).toBe(0)
    // Every fixture should end with a result event
    const last = events[events.length - 1]
    expect(last.kind).toBe('result')
  })
}

// ---- Specific shape assertions ----

test('edit.ndjson: tool-call Edit → tool-result with structuredPatch', () => {
  const events = parseFixture('edit.ndjson')
  const editCall = events.find((e) => e.kind === 'tool-call' && e.name === 'Edit')
  if (!editCall || editCall.kind !== 'tool-call') throw new Error('no Edit tool-call')
  const input = editCall.input as { old_string?: string; new_string?: string }
  expect(input.old_string).toBe('hi')
  expect(input.new_string).toBe('hello')

  const editResult = events.find(
    (e) => e.kind === 'tool-result' && e.toolUseId === editCall.id
  )
  if (!editResult || editResult.kind !== 'tool-result') throw new Error('no Edit result')
  const structured = editResult.structured as { structuredPatch?: unknown[] }
  expect(Array.isArray(structured.structuredPatch)).toBeTruthy()
})

test('read.ndjson: tool-result carries structured file content', () => {
  const events = parseFixture('read.ndjson')
  const readCall = events.find((e) => e.kind === 'tool-call' && e.name === 'Read')
  if (!readCall || readCall.kind !== 'tool-call') throw new Error('no Read call')
  const result = events.find(
    (e) => e.kind === 'tool-result' && e.toolUseId === readCall.id
  )
  if (!result || result.kind !== 'tool-result') throw new Error('no Read result')
  const s = result.structured as { file?: { content?: string; numLines?: number } }
  expect(typeof s.file?.content === 'string').toBeTruthy()
  expect((s.file?.numLines ?? 0) > 0).toBeTruthy()
})

test('todowrite.ndjson: structured oldTodos/newTodos present', () => {
  const events = parseFixture('todowrite.ndjson')
  const call = events.find((e) => e.kind === 'tool-call' && e.name === 'TodoWrite')
  if (!call || call.kind !== 'tool-call') throw new Error('no TodoWrite call')
  const result = events.find(
    (e) => e.kind === 'tool-result' && e.toolUseId === call.id
  )
  if (!result || result.kind !== 'tool-result') throw new Error('no TodoWrite result')
  const s = result.structured as { newTodos?: unknown[] }
  expect(Array.isArray(s.newTodos)).toBeTruthy()
  expect((s.newTodos as unknown[]).length).toBe(3)
})

test('thinking.ndjson: assistant-thinking event with signature flag', () => {
  const events = parseFixture('thinking.ndjson')
  const thinking = events.find((e) => e.kind === 'assistant-thinking')
  if (!thinking || thinking.kind !== 'assistant-thinking') throw new Error('no thinking')
  expect(thinking.hasSignature).toBe(true)
})

test('any fixture: rate-limit event normalized', () => {
  let found = false
  for (const f of fixtureFiles) {
    const events = parseFixture(f)
    const rl = events.find((e) => e.kind === 'rate-limit')
    if (rl && rl.kind === 'rate-limit') {
      expect(rl.status).toBe('allowed')
      found = true
      break
    }
  }
  expect(found).toBeTruthy()
})

test('turn-init has session id + model + tools', () => {
  const events = parseFixture('bash.ndjson')
  const init = events.find((e) => e.kind === 'turn-init')
  if (!init || init.kind !== 'turn-init') throw new Error('no turn-init')
  expect(init.sessionId.length > 0).toBeTruthy()
  expect(init.model.length > 0).toBeTruthy()
  expect(init.tools.length > 0).toBeTruthy()
})

test('result event has cost + usage + modelUsage', () => {
  const events = parseFixture('edit.ndjson')
  const result = events[events.length - 1]
  if (result.kind !== 'result') throw new Error('no result')
  expect(result.totalCostUsd > 0).toBeTruthy()
  expect(result.usage.outputTokens > 0).toBeTruthy()
  expect(Object.keys(result.modelUsage).length > 0).toBeTruthy()
})

// ---- Lenient / forward-compat ----

test('malformed JSON → unknown with reason=parse-error', () => {
  const ev = claudeCodeAdapter.parseLine('{not valid json')
  if (!ev) throw new Error('expected event')
  if (ev.kind !== 'unknown') throw new Error(`expected unknown, got ${ev.kind}`)
  expect(ev.reason).toBe('parse-error')
})

test('unknown top-level type → unknown with reason=unknown-type', () => {
  const ev = claudeCodeAdapter.parseLine(
    JSON.stringify({ type: 'speculative_new_thing', foo: 'bar' })
  )
  if (!ev || ev.kind !== 'unknown') throw new Error('expected unknown')
  expect(ev.reason).toBe('unknown-type')
})

test('shape-mismatched assistant → unknown with reason=shape-mismatch', () => {
  const ev = claudeCodeAdapter.parseLine(
    JSON.stringify({ type: 'assistant' /* no message */ })
  )
  if (!ev || ev.kind !== 'unknown') throw new Error('expected unknown')
  expect(ev.reason).toBe('shape-mismatch')
})

test('empty line → null', () => {
  expect(claudeCodeAdapter.parseLine('')).toBe(null)
  expect(claudeCodeAdapter.parseLine('   ')).toBe(null)
})

test('unknown assistant content block → unknown-type (does not throw)', () => {
  const ev = claudeCodeAdapter.parseLine(
    JSON.stringify({
      type: 'assistant',
      message: { id: 'x', content: [{ type: 'speculative_block', foo: 'bar' }] },
    })
  )
  if (!ev || ev.kind !== 'unknown') throw new Error('expected unknown')
  expect(ev.reason).toBe('unknown-type')
})

// ---- Spawn args + serialize ----

test('buildSpawnArgs: fresh session', () => {
  const { args } = claudeCodeAdapter.buildSpawnArgs({
    sessionId: 'abc',
    resume: false,
    cwd: '/tmp',
    providerFlags: ['--allow-dangerously-skip-permissions'],
  })
  expect(args.includes('--session-id')).toBeTruthy()
  expect(args.includes('abc')).toBeTruthy()
  expect(args.includes('--resume')).toBe(false)
  expect(args.includes('--input-format')).toBeTruthy()
  expect(args.includes('stream-json')).toBeTruthy()
})

test('buildSpawnArgs: resume uses --resume not --session-id', () => {
  const { args } = claudeCodeAdapter.buildSpawnArgs({
    sessionId: 'abc',
    resume: true,
    cwd: '/tmp',
    providerFlags: [],
  })
  expect(args.includes('--resume')).toBeTruthy()
  expect(args.includes('--session-id')).toBe(false)
})

test('serializeUserMessage emits a single NDJSON object (no newline)', () => {
  const out = claudeCodeAdapter.serializeUserMessage('hello', 'sid')
  expect(out.endsWith('\n')).toBe(false)
  const parsed = JSON.parse(out)
  expect(parsed.type).toBe('user')
  expect(parsed.message.content).toBe('hello')
})

test('hook_started / hook_response / task_progress → null (drop noise)', () => {
  for (const subtype of ['hook_started', 'hook_response', 'task_progress']) {
    const out = claudeCodeAdapter.parseLine(
      JSON.stringify({ type: 'system', subtype, hook_id: 'x' })
    )
    expect(out).toBe(null)
  }
})

test('user/text record → null (dup of synthetic user-message)', () => {
  const out = claudeCodeAdapter.parseLine(
    JSON.stringify({
      type: 'user',
      message: { role: 'user', content: [{ type: 'text', text: 'hi' }] },
    })
  )
  expect(out).toBe(null)
})

test('task_started: sub-agent event carries toolUseId + description', () => {
  const ev = claudeCodeAdapter.parseLine(
    JSON.stringify({
      type: 'system',
      subtype: 'task_started',
      tool_use_id: 'tu_42',
      description: 'Find chat history parsing logic',
      task_type: 'local_agent',
      prompt: 'Find …',
    })
  )
  if (!ev || ev.kind !== 'sub-agent') throw new Error('expected sub-agent')
  expect(ev.phase).toBe('started')
  expect(ev.toolUseId).toBe('tu_42')
  expect(ev.description).toBe('Find chat history parsing logic')
})

test('task_notification: sub-agent event carries status + usage', () => {
  const ev = claudeCodeAdapter.parseLine(
    JSON.stringify({
      type: 'system',
      subtype: 'task_notification',
      tool_use_id: 'tu_42',
      status: 'completed',
      summary: 'Find chat history parsing logic',
      usage: { total_tokens: 63119, tool_uses: 23, duration_ms: 52641 },
    })
  )
  if (!ev || ev.kind !== 'sub-agent') throw new Error('expected sub-agent')
  expect(ev.phase).toBe('notification')
  expect(ev.toolUseId).toBe('tu_42')
  expect(ev.status).toBe('completed')
  expect(ev.usage?.totalTokens).toBe(63119)
  expect(ev.usage?.toolUses).toBe(23)
  expect(ev.usage?.durationMs).toBe(52641)
})

test('parent_tool_use_id propagates through assistant tool_use, text, thinking', () => {
  const tool = claudeCodeAdapter.parseLine(
    JSON.stringify({
      type: 'assistant',
      message: { id: 'm1', content: [{ type: 'tool_use', id: 'tu_inner', name: 'Grep', input: { pattern: 'x' } }] },
      parent_tool_use_id: 'tu_TASK',
    })
  )
  if (!tool || tool.kind !== 'tool-call') throw new Error('expected tool-call')
  expect(tool.parentToolUseId).toBe('tu_TASK')

  const text = claudeCodeAdapter.parseLine(
    JSON.stringify({
      type: 'assistant',
      message: { id: 'm2', content: [{ type: 'text', text: 'hi' }] },
      parent_tool_use_id: 'tu_TASK',
    })
  )
  if (!text || text.kind !== 'assistant-text') throw new Error('expected assistant-text')
  expect(text.parentToolUseId).toBe('tu_TASK')

  const think = claudeCodeAdapter.parseLine(
    JSON.stringify({
      type: 'assistant',
      message: { id: 'm3', content: [{ type: 'thinking', thinking: '...' }] },
      parent_tool_use_id: 'tu_TASK',
    })
  )
  if (!think || think.kind !== 'assistant-thinking') throw new Error('expected assistant-thinking')
  expect(think.parentToolUseId).toBe('tu_TASK')
})

test('parent_tool_use_id propagates through tool_result', () => {
  const ev = claudeCodeAdapter.parseLine(
    JSON.stringify({
      type: 'user',
      message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu_inner', content: 'ok' }] },
      parent_tool_use_id: 'tu_TASK',
    })
  )
  if (!ev || ev.kind !== 'tool-result') throw new Error('expected tool-result')
  expect(ev.parentToolUseId).toBe('tu_TASK')
})

test('parent_tool_use_id propagates through stream events (block-start, delta, stop)', () => {
  const start = claudeCodeAdapter.parseLine(
    JSON.stringify({
      type: 'stream_event',
      event: { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 'tu_inner', name: 'Bash' } },
      parent_tool_use_id: 'tu_TASK',
    })
  )
  if (!start || start.kind !== 'stream-block-start') throw new Error('expected stream-block-start')
  expect(start.parentToolUseId).toBe('tu_TASK')

  const delta = claudeCodeAdapter.parseLine(
    JSON.stringify({
      type: 'stream_event',
      event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'a' } },
      parent_tool_use_id: 'tu_TASK',
    })
  )
  if (!delta || delta.kind !== 'stream-block-delta') throw new Error('expected stream-block-delta')
  expect(delta.parentToolUseId).toBe('tu_TASK')

  const stop = claudeCodeAdapter.parseLine(
    JSON.stringify({
      type: 'stream_event',
      event: { type: 'content_block_stop', index: 0 },
      parent_tool_use_id: 'tu_TASK',
    })
  )
  if (!stop || stop.kind !== 'stream-block-stop') throw new Error('expected stream-block-stop')
  expect(stop.parentToolUseId).toBe('tu_TASK')
})

test('null parent_tool_use_id → undefined parentToolUseId (top-level events)', () => {
  const ev = claudeCodeAdapter.parseLine(
    JSON.stringify({
      type: 'assistant',
      message: { id: 'm1', content: [{ type: 'text', text: 'hi' }] },
      parent_tool_use_id: null,
    })
  )
  if (!ev || ev.kind !== 'assistant-text') throw new Error('expected assistant-text')
  expect(ev.parentToolUseId).toBe(undefined)
})

test('extractSessionId: pulls from turn-init, null otherwise', () => {
  const init: AgentEvent = {
    kind: 'turn-init',
    sessionId: 'sid-123',
    model: 'x',
    cwd: '/',
    tools: [],
  }
  expect(claudeCodeAdapter.extractSessionId(init)).toBe('sid-123')

  const result: AgentEvent = {
    kind: 'result',
    subtype: 'success',
    isError: false,
    durationMs: 0,
    durationApiMs: 0,
    numTurns: 0,
    totalCostUsd: 0,
    stopReason: null,
    terminalReason: null,
    text: null,
    modelUsage: {},
    usage: { inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
    permissionDenials: [],
  }
  expect(claudeCodeAdapter.extractSessionId(result)).toBe(null)
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
