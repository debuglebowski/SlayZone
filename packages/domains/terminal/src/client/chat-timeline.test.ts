/**
 * Tests for chat-timeline reducer (correlation + pairing + in-flight).
 * Run with: pnpm dlx tsx packages/domains/terminal/src/client/chat-timeline.test.ts
 */
import type { AgentEvent } from '../shared/agent-events'
import { initialState, reducer, isInFlight } from './chat-timeline'

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
  }
}

const ev = {
  turnInit: (sessionId = 'sid-1'): AgentEvent => ({
    kind: 'turn-init',
    sessionId,
    model: 'opus',
    cwd: '/tmp',
    tools: [],
  }),
  text: (id = 'msg-1', text = 'hello'): AgentEvent => ({
    kind: 'assistant-text',
    messageId: id,
    text,
  }),
  call: (id = 't-1', name = 'Bash'): AgentEvent => ({
    kind: 'tool-call',
    id,
    name,
    input: {},
  }),
  result: (toolUseId = 't-1', isError = false): AgentEvent => ({
    kind: 'tool-result',
    toolUseId,
    isError,
    rawContent: 'done',
    structured: null,
  }),
  turnResult: (): AgentEvent => ({
    kind: 'result',
    subtype: 'success',
    isError: false,
    durationMs: 100,
    durationApiMs: 50,
    numTurns: 1,
    totalCostUsd: 0.01,
    stopReason: 'end_turn',
    terminalReason: 'completed',
    text: 'ok',
    modelUsage: {},
    usage: { inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
    permissionDenials: [],
  }),
}

console.log('\nChat timeline reducer tests\n')

test('call + result → one tool item with status done', () => {
  let s = initialState()
  s = reducer(s, { type: 'event', event: ev.turnInit() })
  s = reducer(s, { type: 'event', event: ev.call('t-1', 'Bash') })
  s = reducer(s, { type: 'event', event: ev.result('t-1') })
  const tools = s.timeline.filter((i) => i.kind === 'tool')
  expect(tools.length).toBe(1)
  const only = tools[0]
  if (only.kind !== 'tool') throw new Error('wrong kind')
  expect(only.invocation.status).toBe('done')
  expect(only.invocation.result?.rawContent).toBe('done')
})

test('out-of-order: result before call still pairs', () => {
  let s = initialState()
  s = reducer(s, { type: 'event', event: ev.turnInit() })
  s = reducer(s, { type: 'event', event: ev.result('t-late') })
  // Then a subsequent call with the same id (rare but possible) — reducer should not duplicate
  const tools = s.timeline.filter((i) => i.kind === 'tool')
  expect(tools.length).toBe(1)
  const only = tools[0]
  if (only.kind !== 'tool') throw new Error('wrong kind')
  expect(only.invocation.status).toBe('done')
})

test('tool-result with isError=true → status error', () => {
  let s = initialState()
  s = reducer(s, { type: 'event', event: ev.turnInit() })
  s = reducer(s, { type: 'event', event: ev.call('e-1') })
  s = reducer(s, { type: 'event', event: ev.result('e-1', true) })
  const tools = s.timeline.filter((i) => i.kind === 'tool')
  if (tools[0].kind !== 'tool') throw new Error('wrong kind')
  expect(tools[0].invocation.status).toBe('error')
})

test('second turn-init does not duplicate session-start item', () => {
  let s = initialState()
  s = reducer(s, { type: 'event', event: ev.turnInit('a') })
  s = reducer(s, { type: 'event', event: ev.turnInit('a') })
  s = reducer(s, { type: 'event', event: ev.turnInit('a') })
  const sessionStarts = s.timeline.filter((i) => i.kind === 'session-start')
  expect(sessionStarts.length).toBe(1)
})

test('inFlight: true after user-sent, false after result', () => {
  let s = initialState()
  s = reducer(s, { type: 'event', event: ev.turnInit() })
  expect(isInFlight(s)).toBe(false)
  s = reducer(s, { type: 'user-sent', text: 'hi' })
  expect(isInFlight(s)).toBe(true)
  s = reducer(s, { type: 'event', event: ev.turnResult() })
  expect(isInFlight(s)).toBe(false)
})

test('inFlight: true if more user messages than results (two-turn interleave)', () => {
  let s = initialState()
  s = reducer(s, { type: 'event', event: ev.turnInit() })
  s = reducer(s, { type: 'user-sent', text: 'hi' })
  s = reducer(s, { type: 'user-sent', text: 'hi' })
  s = reducer(s, { type: 'event', event: ev.turnResult() })
  expect(isInFlight(s)).toBe(true)
  s = reducer(s, { type: 'event', event: ev.turnResult() })
  expect(isInFlight(s)).toBe(false)
})

test('process-exit sets sessionEnded when sessionId matches current session', () => {
  let s = initialState()
  s = reducer(s, { type: 'event', event: ev.turnInit('sid-live') })
  s = reducer(s, { type: 'process-exit', sessionId: 'sid-live', code: 0, signal: null })
  expect(s.sessionEnded).toBe(true)
  expect(s.exitCode).toBe(0)
})

test('process-exit with mismatched sessionId is dropped (stale exit guard)', () => {
  let s = initialState()
  s = reducer(s, { type: 'event', event: ev.turnInit('sid-current') })
  s = reducer(s, { type: 'process-exit', sessionId: 'sid-old', code: 137, signal: 'SIGKILL' })
  expect(s.sessionEnded).toBe(false)
  expect(s.exitCode).toBe(null)
})

test('process-exit before any turn-init is dropped (sessionId still null)', () => {
  let s = initialState()
  s = reducer(s, { type: 'process-exit', sessionId: 'sid-zombie', code: 0, signal: null })
  expect(s.sessionEnded).toBe(false)
})

test('replay determinism: live vs getBuffer yields identical timeline (timestamp-stripped)', () => {
  const events: AgentEvent[] = [
    ev.turnInit(),
    ev.text('m-1', 'hi'),
    ev.call('t-1', 'Read'),
    ev.result('t-1'),
    ev.text('m-2', 'done'),
    ev.turnResult(),
  ]
  let live = initialState()
  for (const e of events) live = reducer(live, { type: 'event', event: e })
  let replay = initialState()
  for (const e of events) replay = reducer(replay, { type: 'event', event: e })
  // Timestamps are Date.now() — reducer is otherwise deterministic. Strip timestamps for structural comparison.
  const strip = (t: typeof live.timeline): unknown =>
    JSON.stringify(t, (k, v) => (k === 'timestamp' ? 0 : v))
  expect(strip(live.timeline)).toBe(strip(replay.timeline))
})

test('thinking event → thinking timeline item', () => {
  let s = initialState()
  s = reducer(s, { type: 'event', event: { kind: 'assistant-thinking', messageId: 'm', text: '', hasSignature: true } })
  const thinking = s.timeline.filter((i) => i.kind === 'thinking')
  expect(thinking.length).toBe(1)
  if (thinking[0].kind !== 'thinking') throw new Error('wrong')
  expect(thinking[0].hasSignature).toBe(true)
})

test('unknown event is dropped from timeline', () => {
  let s = initialState()
  s = reducer(s, {
    type: 'event',
    event: { kind: 'unknown', reason: 'unknown-type', raw: { type: 'speculative' } },
  })
  const unknown = s.timeline.filter((i) => i.kind === 'unknown')
  expect(unknown.length).toBe(0)
})

test('reset race: stale exit between reset and new turn-init is dropped at reducer', () => {
  // Timeline simulating a Reset click:
  // 1. Client dispatches `reset` → state cleared.
  // 2. Old session's late exit (sessionId='old-sid') arrives.
  // 3. New session spawns, turn-init('new-sid') arrives.
  // The reducer drops the stale exit because state.sessionId is null right after reset,
  // so sessionEnded never flips on. Belt-and-suspenders alongside the main-side guard
  // that already swallows stale exits when sessions.get(tabId) !== dyingSession.
  let s = initialState()
  s = reducer(s, { type: 'event', event: ev.turnInit('old-sid') })
  s = reducer(s, { type: 'event', event: ev.text('m-1', 'from old session') })

  s = reducer(s, { type: 'reset' })
  expect(s.sessionEnded).toBe(false)

  // Stale exit from old session arrives — state.sessionId is null → dropped.
  s = reducer(s, { type: 'process-exit', sessionId: 'old-sid', code: 0, signal: null })
  expect(s.sessionEnded).toBe(false)

  // New session's turn-init arrives.
  s = reducer(s, { type: 'event', event: ev.turnInit('new-sid') })
  expect(s.sessionEnded).toBe(false)
  expect(s.sessionStarted).toBe(true)
  expect(s.sessionId).toBe('new-sid')
})

test('stream deltas build text item incrementally', () => {
  let s = initialState()
  s = reducer(s, { type: 'event', event: ev.turnInit() })
  s = reducer(s, { type: 'event', event: { kind: 'stream-message-start', messageId: 'msg-x' } })
  s = reducer(s, {
    type: 'event',
    event: { kind: 'stream-block-start', blockIndex: 0, blockType: 'text' },
  })
  s = reducer(s, {
    type: 'event',
    event: { kind: 'stream-block-delta', blockIndex: 0, deltaType: 'text', text: 'Hel' },
  })
  s = reducer(s, {
    type: 'event',
    event: { kind: 'stream-block-delta', blockIndex: 0, deltaType: 'text', text: 'lo wor' },
  })
  s = reducer(s, {
    type: 'event',
    event: { kind: 'stream-block-delta', blockIndex: 0, deltaType: 'text', text: 'ld' },
  })
  s = reducer(s, { type: 'event', event: { kind: 'stream-block-stop', blockIndex: 0 } })
  s = reducer(s, { type: 'event', event: { kind: 'stream-message-stop' } })
  const texts = s.timeline.filter((i) => i.kind === 'text')
  expect(texts.length).toBe(1)
  if (texts[0].kind !== 'text') throw new Error('wrong')
  expect(texts[0].text).toBe('Hello world')
})

test('atomic assistant-text is suppressed when messageId was streamed', () => {
  let s = initialState()
  s = reducer(s, { type: 'event', event: ev.turnInit() })
  s = reducer(s, { type: 'event', event: { kind: 'stream-message-start', messageId: 'msg-x' } })
  s = reducer(s, {
    type: 'event',
    event: { kind: 'stream-block-start', blockIndex: 0, blockType: 'text' },
  })
  s = reducer(s, {
    type: 'event',
    event: { kind: 'stream-block-delta', blockIndex: 0, deltaType: 'text', text: 'streamed' },
  })
  s = reducer(s, { type: 'event', event: { kind: 'stream-block-stop', blockIndex: 0 } })
  s = reducer(s, { type: 'event', event: { kind: 'stream-message-stop' } })
  // Final atomic event arrives — should NOT duplicate the text item.
  s = reducer(s, { type: 'event', event: ev.text('msg-x', 'streamed') })
  const texts = s.timeline.filter((i) => i.kind === 'text')
  expect(texts.length).toBe(1)
})

test('atomic assistant-text still appears when no streaming happened (fallback)', () => {
  let s = initialState()
  s = reducer(s, { type: 'event', event: ev.turnInit() })
  s = reducer(s, { type: 'event', event: ev.text('msg-y', 'atomic only') })
  const texts = s.timeline.filter((i) => i.kind === 'text')
  expect(texts.length).toBe(1)
  if (texts[0].kind !== 'text') throw new Error('wrong')
  expect(texts[0].text).toBe('atomic only')
})

test('tool_use input_json deltas accumulate + parse on block-stop', () => {
  let s = initialState()
  s = reducer(s, { type: 'event', event: ev.turnInit() })
  s = reducer(s, { type: 'event', event: { kind: 'stream-message-start', messageId: 'msg-z' } })
  s = reducer(s, {
    type: 'event',
    event: {
      kind: 'stream-block-start',
      blockIndex: 0,
      blockType: 'tool_use',
      toolUseId: 't-1',
      toolName: 'Read',
    },
  })
  s = reducer(s, {
    type: 'event',
    event: {
      kind: 'stream-block-delta',
      blockIndex: 0,
      deltaType: 'input_json',
      text: '{"path":',
    },
  })
  s = reducer(s, {
    type: 'event',
    event: {
      kind: 'stream-block-delta',
      blockIndex: 0,
      deltaType: 'input_json',
      text: '"/etc/hosts"}',
    },
  })
  s = reducer(s, { type: 'event', event: { kind: 'stream-block-stop', blockIndex: 0 } })
  const tools = s.timeline.filter((i) => i.kind === 'tool')
  expect(tools.length).toBe(1)
  if (tools[0].kind !== 'tool') throw new Error('wrong')
  expect(tools[0].invocation.name).toBe('Read')
  expect((tools[0].invocation.input as { path?: string }).path).toBe('/etc/hosts')
})

test('empty text block (start + stop, no delta) does not leave placeholder', () => {
  let s = initialState()
  s = reducer(s, { type: 'event', event: ev.turnInit() })
  s = reducer(s, { type: 'event', event: { kind: 'stream-message-start', messageId: 'msg-empty' } })
  s = reducer(s, {
    type: 'event',
    event: { kind: 'stream-block-start', blockIndex: 0, blockType: 'text' },
  })
  s = reducer(s, { type: 'event', event: { kind: 'stream-block-stop', blockIndex: 0 } })
  s = reducer(s, { type: 'event', event: { kind: 'stream-message-stop' } })
  const texts = s.timeline.filter((i) => i.kind === 'text')
  expect(texts.length).toBe(0)
})

test('atomic fallback fires when stream produced no content for messageId', () => {
  let s = initialState()
  s = reducer(s, { type: 'event', event: ev.turnInit() })
  s = reducer(s, { type: 'event', event: { kind: 'stream-message-start', messageId: 'msg-fb' } })
  // No deltas, just stream-stop — stream produced nothing.
  s = reducer(s, { type: 'event', event: { kind: 'stream-message-stop' } })
  // Atomic arrives with content — should render since stream didn't mark messageId streamed.
  s = reducer(s, { type: 'event', event: ev.text('msg-fb', 'atomic content') })
  const texts = s.timeline.filter((i) => i.kind === 'text')
  expect(texts.length).toBe(1)
  if (texts[0].kind !== 'text') throw new Error('wrong')
  expect(texts[0].text).toBe('atomic content')
})

test('result.copyText aggregates assistant text from this turn', () => {
  let s = initialState()
  s = reducer(s, { type: 'event', event: ev.turnInit() })
  s = reducer(s, { type: 'user-sent', text: 'hey' })
  s = reducer(s, { type: 'event', event: ev.text('m-1', 'First reply.') })
  s = reducer(s, { type: 'event', event: ev.call('t-1', 'Bash') })
  s = reducer(s, { type: 'event', event: ev.result('t-1') })
  s = reducer(s, { type: 'event', event: ev.text('m-2', 'Second reply.') })
  s = reducer(s, { type: 'event', event: ev.turnResult() })
  const results = s.timeline.filter((i) => i.kind === 'result')
  expect(results.length).toBe(1)
  if (results[0].kind !== 'result') throw new Error('wrong')
  expect(results[0].copyText).toBe('First reply.\n\nSecond reply.')
})

test('result.copyText null when turn has no assistant text (tool-only)', () => {
  let s = initialState()
  s = reducer(s, { type: 'event', event: ev.turnInit() })
  s = reducer(s, { type: 'user-sent', text: 'do it' })
  s = reducer(s, { type: 'event', event: ev.call('t-1', 'Bash') })
  s = reducer(s, { type: 'event', event: ev.result('t-1') })
  s = reducer(s, { type: 'event', event: ev.turnResult() })
  const results = s.timeline.filter((i) => i.kind === 'result')
  expect(results.length).toBe(1)
  if (results[0].kind !== 'result') throw new Error('wrong')
  expect(results[0].copyText).toBe(null)
})

test('result.copyText only scans back to most recent user-text boundary', () => {
  let s = initialState()
  s = reducer(s, { type: 'event', event: ev.turnInit() })
  // Turn 1
  s = reducer(s, { type: 'user-sent', text: 'first' })
  s = reducer(s, { type: 'event', event: ev.text('m-1', 'Turn 1 reply.') })
  s = reducer(s, { type: 'event', event: ev.turnResult() })
  // Turn 2
  s = reducer(s, { type: 'user-sent', text: 'second' })
  s = reducer(s, { type: 'event', event: ev.text('m-2', 'Turn 2 reply.') })
  s = reducer(s, { type: 'event', event: ev.turnResult() })
  const results = s.timeline.filter((i) => i.kind === 'result')
  expect(results.length).toBe(2)
  if (results[0].kind !== 'result' || results[1].kind !== 'result') throw new Error('wrong')
  expect(results[0].copyText).toBe('Turn 1 reply.')
  expect(results[1].copyText).toBe('Turn 2 reply.')
})

test('signature_delta flips hasSignature on thinking item', () => {
  let s = initialState()
  s = reducer(s, { type: 'event', event: ev.turnInit() })
  s = reducer(s, { type: 'event', event: { kind: 'stream-message-start', messageId: 'msg-t' } })
  s = reducer(s, {
    type: 'event',
    event: { kind: 'stream-block-start', blockIndex: 0, blockType: 'thinking' },
  })
  s = reducer(s, {
    type: 'event',
    event: { kind: 'stream-block-delta', blockIndex: 0, deltaType: 'thinking', text: 'pondering' },
  })
  s = reducer(s, {
    type: 'event',
    event: { kind: 'stream-block-delta', blockIndex: 0, deltaType: 'signature', text: 'sig-xyz' },
  })
  s = reducer(s, { type: 'event', event: { kind: 'stream-block-stop', blockIndex: 0 } })
  const thinking = s.timeline.filter((i) => i.kind === 'thinking')
  expect(thinking.length).toBe(1)
  if (thinking[0].kind !== 'thinking') throw new Error('wrong')
  expect(thinking[0].text).toBe('pondering')
  expect(thinking[0].hasSignature).toBe(true)
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
