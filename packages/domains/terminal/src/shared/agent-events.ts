/**
 * Normalized event shape produced by AgentAdapter.parseLine().
 * UI and transport manager speak this union, never raw provider JSON.
 *
 * Discovered during Spike B (2026-04-18, Claude Code 2.1.114).
 * See packages/domains/terminal/test/fixtures/claude-stream/SPIKE.md.
 */

export type AgentEvent =
  | TurnInitEvent
  | AssistantTextEvent
  | AssistantThinkingEvent
  | ToolCallEvent
  | ToolResultEvent
  | ResultEvent
  | RateLimitEvent
  | ApiRetryEvent
  | CompactBoundaryEvent
  | SubAgentEvent
  | StderrEvent
  | ProcessExitEvent
  | ErrorEvent
  | UnknownEvent
  | StreamMessageStartEvent
  | StreamBlockStartEvent
  | StreamBlockDeltaEvent
  | StreamBlockStopEvent
  | StreamMessageStopEvent

/**
 * Streaming events from Claude Code's `--verbose` stream-json output.
 * Wrap Anthropic API SSE events (message_start, content_block_*, message_stop).
 * Adapter is stateless — reducer tracks `currentStreamMessageId` and resolves blocks via `blockIndex`.
 */
export interface StreamMessageStartEvent {
  kind: 'stream-message-start'
  messageId: string
}

export type StreamBlockType = 'text' | 'thinking' | 'tool_use'

export interface StreamBlockStartEvent {
  kind: 'stream-block-start'
  blockIndex: number
  blockType: StreamBlockType
  /** Only for tool_use blocks. */
  toolUseId?: string
  toolName?: string
}

export type StreamDeltaType = 'text' | 'thinking' | 'signature' | 'input_json'

export interface StreamBlockDeltaEvent {
  kind: 'stream-block-delta'
  blockIndex: number
  deltaType: StreamDeltaType
  /** For text/thinking: the chunk. For signature: signature string. For input_json: partial JSON. */
  text: string
}

export interface StreamBlockStopEvent {
  kind: 'stream-block-stop'
  blockIndex: number
}

export interface StreamMessageStopEvent {
  kind: 'stream-message-stop'
}

export interface TurnInitEvent {
  kind: 'turn-init'
  sessionId: string
  model: string
  cwd: string
  tools: string[]
  permissionMode?: string
}

export interface AssistantTextEvent {
  kind: 'assistant-text'
  messageId: string
  text: string
}

export interface AssistantThinkingEvent {
  kind: 'assistant-thinking'
  messageId: string
  text: string
  hasSignature: boolean
}

export interface ToolCallEvent {
  kind: 'tool-call'
  id: string
  name: string
  input: unknown
}

export interface ToolResultEvent {
  kind: 'tool-result'
  toolUseId: string
  isError: boolean
  rawContent: unknown
  structured: unknown
}

export interface ResultEvent {
  kind: 'result'
  subtype: string
  isError: boolean
  durationMs: number
  durationApiMs: number
  numTurns: number
  totalCostUsd: number
  stopReason: string | null
  terminalReason: string | null
  text: string | null
  modelUsage: Record<string, ModelUsage>
  usage: TokenUsage
  permissionDenials: unknown[]
}

export interface ModelUsage {
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens: number
  cacheCreationInputTokens: number
  costUsd: number
}

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens: number
  cacheCreationInputTokens: number
}

export interface RateLimitEvent {
  kind: 'rate-limit'
  status: string
  rateLimitType: string
  resetsAt: number | null
  overageStatus: string | null
}

export interface ApiRetryEvent {
  kind: 'api-retry'
  attempt: number
  maxRetries: number
  delayMs: number
  error: string
}

export interface CompactBoundaryEvent {
  kind: 'compact-boundary'
}

export interface SubAgentEvent {
  kind: 'sub-agent'
  phase: 'started' | 'updated' | 'notification'
  raw: unknown
}

export interface StderrEvent {
  kind: 'stderr'
  text: string
}

export interface ProcessExitEvent {
  kind: 'process-exit'
  code: number | null
  signal: string | null
}

export interface ErrorEvent {
  kind: 'error'
  message: string
  detail?: unknown
}

export interface UnknownEvent {
  kind: 'unknown'
  reason: 'parse-error' | 'unknown-type' | 'shape-mismatch'
  raw: unknown
}
