import type { CodeMode } from '@slayzone/terminal/shared'

export type TerminalMode = 'ccs' | 'claude-code' | 'codex' | 'cursor-agent' | 'gemini' | 'opencode' | 'terminal'
export type { CodeMode }

// Activity states for CLI tools
export type ActivityState = 'attention' | 'working' | 'unknown'

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

export interface ValidationResult {
  check: string
  ok: boolean
  detail: string
  fix?: string
}

export interface TerminalAdapter {
  readonly mode: TerminalMode

  /** Idle timeout in ms (null = use default 60s) */
  readonly idleTimeoutMs: number | null

  /**
   * If true, pty-manager transitions to 'working' when user presses Enter.
   * Useful for full-screen TUIs that constantly redraw (making output-based
   * detection unreliable). Paired with idleTimeoutMs for return to 'attention'.
   */
  readonly transitionOnInput?: boolean

  /** Command to run in terminal to discover session ID. Undefined = supports --session-id at creation. */
  readonly sessionIdCommand?: string

  /**
   * Build spawn configuration for this terminal mode.
   */
  buildSpawnConfig(cwd: string, conversationId?: string, resuming?: boolean, initialPrompt?: string, providerArgs?: string[], codeMode?: CodeMode): SpawnConfig

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

  /**
   * Validate that the CLI binary and dependencies are available.
   * Returns a list of check results with fix instructions for failed checks.
   */
  validate?(): Promise<ValidationResult[]>
}
