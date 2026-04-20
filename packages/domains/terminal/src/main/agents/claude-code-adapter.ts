import type {
  AgentEvent,
  ResultEvent,
  ModelUsage,
  TokenUsage,
} from '../../shared/agent-events'
import type { AgentAdapter, AgentSpawnOpts, SpawnArgs } from './types'

/**
 * Claude Code stream-json transport.
 *
 * Emits via: claude -p --input-format stream-json --output-format stream-json --verbose ...
 * Schema reverse-engineered from real sessions — see
 * packages/domains/terminal/test/fixtures/claude-stream/SPIKE.md.
 */
export const claudeCodeAdapter: AgentAdapter = {
  id: 'claude-code',
  binaryName: 'claude',

  buildSpawnArgs(opts: AgentSpawnOpts): SpawnArgs {
    const base = [
      '-p',
      '--input-format', 'stream-json',
      '--output-format', 'stream-json',
      '--verbose',
    ]
    if (opts.resume) {
      base.push('--resume', opts.sessionId)
    } else {
      base.push('--session-id', opts.sessionId)
    }
    base.push(...opts.providerFlags)
    return { args: base }
  },

  parseLine(line: string): AgentEvent | null {
    const trimmed = line.trim()
    if (!trimmed) return null

    let obj: Record<string, unknown>
    try {
      obj = JSON.parse(trimmed)
    } catch {
      return { kind: 'unknown', reason: 'parse-error', raw: trimmed }
    }
    if (typeof obj !== 'object' || obj === null) {
      return { kind: 'unknown', reason: 'shape-mismatch', raw: obj }
    }

    const type = obj.type
    switch (type) {
      case 'system':
        return parseSystem(obj)
      case 'assistant':
        return parseAssistant(obj)
      case 'user':
        return parseUser(obj)
      case 'result':
        return parseResult(obj)
      case 'rate_limit_event':
        return parseRateLimit(obj)
      case 'stream_event':
        return parseStreamEvent(obj)
      default:
        return { kind: 'unknown', reason: 'unknown-type', raw: obj }
    }
  },

  serializeUserMessage(text: string, _sessionId: string): string {
    return JSON.stringify({
      type: 'user',
      message: { role: 'user', content: text },
    })
  },

  extractSessionId(event: AgentEvent): string | null {
    if (event.kind === 'turn-init') return event.sessionId
    return null
  },
}

// ------- internal parsers ---------

/**
 * Parse Claude Code's stream_event wrapper which envelopes one Anthropic SSE event.
 * Shape: `{"type":"stream_event","event":{...anthropic...},"parent_tool_use_id":null,"session_id":"..."}`.
 */
function parseStreamEvent(obj: Record<string, unknown>): AgentEvent | null {
  const inner = obj.event as Record<string, unknown> | undefined
  if (!inner || typeof inner !== 'object') return null
  const t = inner.type
  switch (t) {
    case 'message_start': {
      const message = inner.message as { id?: string } | undefined
      return { kind: 'stream-message-start', messageId: message?.id ?? '' }
    }
    case 'content_block_start': {
      const block = inner.content_block as
        | { type?: string; id?: string; name?: string }
        | undefined
      const index = typeof inner.index === 'number' ? inner.index : 0
      if (!block) return null
      if (block.type === 'text') {
        return { kind: 'stream-block-start', blockIndex: index, blockType: 'text' }
      }
      if (block.type === 'thinking') {
        return { kind: 'stream-block-start', blockIndex: index, blockType: 'thinking' }
      }
      if (block.type === 'tool_use') {
        return {
          kind: 'stream-block-start',
          blockIndex: index,
          blockType: 'tool_use',
          toolUseId: block.id,
          toolName: block.name,
        }
      }
      return null
    }
    case 'content_block_delta': {
      const d = inner.delta as
        | { type?: string; text?: string; thinking?: string; signature?: string; partial_json?: string }
        | undefined
      const index = typeof inner.index === 'number' ? inner.index : 0
      if (!d) return null
      if (d.type === 'text_delta') {
        return { kind: 'stream-block-delta', blockIndex: index, deltaType: 'text', text: d.text ?? '' }
      }
      if (d.type === 'thinking_delta') {
        return { kind: 'stream-block-delta', blockIndex: index, deltaType: 'thinking', text: d.thinking ?? '' }
      }
      if (d.type === 'signature_delta') {
        return { kind: 'stream-block-delta', blockIndex: index, deltaType: 'signature', text: d.signature ?? '' }
      }
      if (d.type === 'input_json_delta') {
        return { kind: 'stream-block-delta', blockIndex: index, deltaType: 'input_json', text: d.partial_json ?? '' }
      }
      return null
    }
    case 'content_block_stop': {
      const index = typeof inner.index === 'number' ? inner.index : 0
      return { kind: 'stream-block-stop', blockIndex: index }
    }
    case 'message_stop':
      return { kind: 'stream-message-stop' }
    case 'message_delta':
      return null
    default:
      return null
  }
}

function parseSystem(obj: Record<string, unknown>): AgentEvent {
  const subtype = obj.subtype as string | undefined
  if (subtype === 'init') {
    return {
      kind: 'turn-init',
      sessionId: (obj.session_id as string) ?? '',
      model: (obj.model as string) ?? '',
      cwd: (obj.cwd as string) ?? '',
      tools: Array.isArray(obj.tools) ? (obj.tools as string[]) : [],
      permissionMode: (obj.permissionMode as string) ?? undefined,
    }
  }
  if (subtype === 'compact_boundary') {
    return { kind: 'compact-boundary' }
  }
  if (subtype === 'task_started' || subtype === 'task_updated' || subtype === 'task_notification') {
    return {
      kind: 'sub-agent',
      phase: subtype === 'task_started' ? 'started'
        : subtype === 'task_updated' ? 'updated'
        : 'notification',
      raw: obj,
    }
  }
  if (subtype === 'api_retry') {
    return {
      kind: 'api-retry',
      attempt: (obj.attempt as number) ?? 0,
      maxRetries: (obj.max_retries as number) ?? 0,
      delayMs: (obj.retry_delay_ms as number) ?? 0,
      error: (obj.error as string) ?? '',
    }
  }
  return { kind: 'unknown', reason: 'unknown-type', raw: obj }
}

interface RawContentBlock {
  type?: string
  text?: string
  thinking?: string
  signature?: string
  id?: string
  name?: string
  input?: unknown
  tool_use_id?: string
  content?: unknown
}

function parseAssistant(obj: Record<string, unknown>): AgentEvent {
  const message = obj.message as { id?: string; content?: RawContentBlock[] } | undefined
  if (!message) return { kind: 'unknown', reason: 'shape-mismatch', raw: obj }
  const messageId = message.id ?? ''
  const blocks = Array.isArray(message.content) ? message.content : []

  // Spike B confirmed: assistant events are block-scoped (one content block per event).
  // If we ever see multiple blocks, take the first — reducer can handle it, but warn.
  const block = blocks[0]
  if (!block) return { kind: 'unknown', reason: 'shape-mismatch', raw: obj }

  if (block.type === 'text') {
    return {
      kind: 'assistant-text',
      messageId,
      text: block.text ?? '',
    }
  }
  if (block.type === 'thinking') {
    return {
      kind: 'assistant-thinking',
      messageId,
      text: block.thinking ?? '',
      hasSignature: Boolean(block.signature),
    }
  }
  if (block.type === 'tool_use') {
    return {
      kind: 'tool-call',
      id: block.id ?? '',
      name: block.name ?? '',
      input: block.input,
    }
  }
  return { kind: 'unknown', reason: 'unknown-type', raw: obj }
}

function parseUser(obj: Record<string, unknown>): AgentEvent {
  const message = obj.message as { content?: RawContentBlock[] } | undefined
  const toolUseResult = obj.tool_use_result
  if (!message || !Array.isArray(message.content)) {
    return { kind: 'unknown', reason: 'shape-mismatch', raw: obj }
  }
  const block = message.content[0]
  if (block?.type !== 'tool_result' || !block.tool_use_id) {
    return { kind: 'unknown', reason: 'shape-mismatch', raw: obj }
  }
  const rawContent = block.content
  // is_error can be boolean field on block, or inferred from structured result
  const isError = Boolean((block as { is_error?: boolean }).is_error)
  return {
    kind: 'tool-result',
    toolUseId: block.tool_use_id,
    isError,
    rawContent: rawContent ?? null,
    structured: toolUseResult ?? null,
  }
}

function parseResult(obj: Record<string, unknown>): ResultEvent {
  const usage = (obj.usage ?? {}) as Record<string, unknown>
  const modelUsageRaw = (obj.modelUsage ?? {}) as Record<string, Record<string, unknown>>
  const modelUsage: Record<string, ModelUsage> = {}
  for (const [model, u] of Object.entries(modelUsageRaw)) {
    modelUsage[model] = {
      inputTokens: toNum(u.inputTokens),
      outputTokens: toNum(u.outputTokens),
      cacheReadInputTokens: toNum(u.cacheReadInputTokens),
      cacheCreationInputTokens: toNum(u.cacheCreationInputTokens),
      costUsd: toNum(u.costUSD),
    }
  }
  const tokenUsage: TokenUsage = {
    inputTokens: toNum(usage.input_tokens),
    outputTokens: toNum(usage.output_tokens),
    cacheReadInputTokens: toNum(usage.cache_read_input_tokens),
    cacheCreationInputTokens: toNum(usage.cache_creation_input_tokens),
  }
  return {
    kind: 'result',
    subtype: (obj.subtype as string) ?? 'unknown',
    isError: Boolean(obj.is_error),
    durationMs: toNum(obj.duration_ms),
    durationApiMs: toNum(obj.duration_api_ms),
    numTurns: toNum(obj.num_turns),
    totalCostUsd: toNum(obj.total_cost_usd),
    stopReason: (obj.stop_reason as string) ?? null,
    terminalReason: (obj.terminal_reason as string) ?? null,
    text: (obj.result as string) ?? null,
    modelUsage,
    usage: tokenUsage,
    permissionDenials: Array.isArray(obj.permission_denials) ? obj.permission_denials : [],
  }
}

function parseRateLimit(obj: Record<string, unknown>): AgentEvent {
  const info = (obj.rate_limit_info ?? {}) as Record<string, unknown>
  return {
    kind: 'rate-limit',
    status: (info.status as string) ?? 'unknown',
    rateLimitType: (info.rateLimitType as string) ?? '',
    resetsAt: typeof info.resetsAt === 'number' ? info.resetsAt : null,
    overageStatus: (info.overageStatus as string) ?? null,
  }
}

function toNum(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}
