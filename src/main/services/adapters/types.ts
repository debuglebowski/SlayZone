import type { TerminalState, CodeMode } from '../../../shared/types/api'

export type TerminalMode = 'claude-code' | 'codex' | 'terminal'
export type { CodeMode }

export interface SpawnConfig {
  shell: string
  args: string[]
  env?: Record<string, string>
  /** Command to run after shell starts (e.g., "claude --session-id X") */
  postSpawnCommand?: string
}

export interface PromptInfo {
  type: 'permission' | 'question' | 'input'
  text: string
  position: number
}

export interface StructuredEvent {
  type: string
  data: unknown
}

export interface TerminalAdapter {
  readonly mode: TerminalMode

  /**
   * Build spawn configuration for this terminal mode.
   */
  buildSpawnConfig(cwd: string, conversationId?: string, resuming?: boolean, shellOverride?: string, initialPrompt?: string, dangerouslySkipPermissions?: boolean, codeMode?: CodeMode): SpawnConfig

  /**
   * Detect if output indicates a prompt that needs user input.
   * Returns null if no prompt detected.
   */
  detectPrompt(data: string): PromptInfo | null

  /**
   * Parse structured events from output (e.g., JSON events from CLI).
   * Returns null if no structured event found.
   */
  parseEvent(data: string): StructuredEvent | null

  /**
   * Detect state changes from output.
   * Returns null if no state change indicated.
   */
  detectState(data: string, currentState: TerminalState): TerminalState | null
}
