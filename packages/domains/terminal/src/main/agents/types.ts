import type { AgentEvent } from '../../shared/agent-events'

export interface AgentSpawnOpts {
  /** Session ID — either a fresh UUID (new session) or existing conversationId for --resume. */
  sessionId: string
  /** True if resuming an existing conversation. Adapter decides flag translation. */
  resume: boolean
  /** Working directory for the agent process. */
  cwd: string
  /** Shell-parsed provider flags (e.g. --allow-dangerously-skip-permissions). */
  providerFlags: string[]
}

export interface SpawnArgs {
  /** Command-line arguments (no binary prefix). Binary resolved separately via whichBinary. */
  args: string[]
}

/**
 * Normalizes one CLI provider's stream into the AgentEvent union.
 * v1: only ClaudeCodeAdapter. Future: Codex, Gemini ACP.
 *
 * Contract:
 * - `parseLine` is stateless per-line (caller handles buffering via readline).
 * - Must never throw. On malformed/unknown input, return UnknownEvent.
 * - `serializeUserMessage` produces ONE NDJSON line (no trailing newline — caller appends).
 */
export interface AgentAdapter {
  readonly id: string
  readonly binaryName: string

  buildSpawnArgs(opts: AgentSpawnOpts): SpawnArgs

  parseLine(line: string): AgentEvent | null

  serializeUserMessage(text: string, sessionId: string): string

  /**
   * If the event carries session/conversation id info, return it so the transport
   * can persist it via setProviderConversationId.
   */
  extractSessionId(event: AgentEvent): string | null
}
