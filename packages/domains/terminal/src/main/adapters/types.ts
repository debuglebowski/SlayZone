import type { CodeMode } from '@omgslayzone/terminal/shared'

export type TerminalMode = 'claude-code' | 'codex' | 'terminal'
export type { CodeMode }

// Activity states for CLI tools
export type ActivityState = 'idle' | 'thinking' | 'tool_use' | 'awaiting_input' | 'unknown'

// Error info from CLI
export interface ErrorInfo {
  code: string
  message: string
  recoverable: boolean
}

// Full CLI state (alive tracked by pty-manager via process exit)
export interface CLIState {
  alive: boolean
  activity: ActivityState
  error: ErrorInfo | null
}

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

export interface TerminalAdapter {
  readonly mode: TerminalMode

  /** Idle timeout in ms (null = use default 60s) */
  readonly idleTimeoutMs: number | null

  /**
   * Build spawn configuration for this terminal mode.
   */
  buildSpawnConfig(cwd: string, conversationId?: string, resuming?: boolean, shellOverride?: string, initialPrompt?: string, dangerouslySkipPermissions?: boolean, codeMode?: CodeMode): SpawnConfig

  /**
   * Detect activity state from terminal output.
   * Returns null if no change detected.
   */
  detectActivity(data: string, current: ActivityState): ActivityState | null

  /**
   * Detect errors from terminal output.
   * Returns null if no error detected.
   */
  detectError(data: string): ErrorInfo | null

  /**
   * Detect if output indicates a prompt that needs user input.
   * Returns null if no prompt detected.
   */
  detectPrompt(data: string): PromptInfo | null
}
