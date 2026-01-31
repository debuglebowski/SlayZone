export type TerminalMode = 'claude-code' | 'codex' | 'terminal'
export type TerminalState = 'starting' | 'running' | 'idle' | 'awaiting_input' | 'error' | 'dead'
export type CodeMode = 'normal' | 'plan' | 'accept-edits' | 'bypass'

// CLI activity states (more granular than TerminalState)
export type ActivityState = 'idle' | 'working' | 'awaiting_input' | 'unknown'

// CLI error info
export interface ErrorInfo {
  code: string
  message: string
  recoverable: boolean
}

// Full CLI state
export interface CLIState {
  alive: boolean
  activity: ActivityState
  error: ErrorInfo | null
}

export interface PtyInfo {
  taskId: string
  lastOutputTime: number
  state: TerminalState
}

// Buffer chunk with sequence number for ordering
export interface BufferChunk {
  seq: number
  data: string
}

// Result from getBufferSince
export interface BufferSinceResult {
  chunks: BufferChunk[]
  currentSeq: number
}

export interface PromptInfo {
  type: 'permission' | 'question' | 'input'
  text: string
  position: number
}

// Claude CLI availability check result
export interface ClaudeAvailability {
  available: boolean
  path: string | null
  version: string | null
}
