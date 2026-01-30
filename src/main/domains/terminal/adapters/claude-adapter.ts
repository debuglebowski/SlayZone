import { platform, homedir } from 'os'
import type { TerminalAdapter, SpawnConfig, PromptInfo, CodeMode, ActivityState, ErrorInfo } from './types'

/**
 * Adapter for Claude Code CLI.
 * Uses pattern-based heuristics for activity detection in interactive mode.
 */
export class ClaudeAdapter implements TerminalAdapter {
  readonly mode = 'claude-code' as const
  readonly idleTimeoutMs = null // use default 60s

  buildSpawnConfig(_cwd: string, conversationId?: string, resuming?: boolean, _shellOverride?: string, initialPrompt?: string, dangerouslySkipPermissions?: boolean, codeMode?: CodeMode): SpawnConfig {
    const claudeArgs: string[] = []

    // Pass --resume for existing sessions, --session-id for new ones
    if (resuming && conversationId) {
      claudeArgs.push('--resume', conversationId)
    } else if (conversationId) {
      claudeArgs.push('--session-id', conversationId)
    }

    // Add dangerously skip permissions flag if enabled (or bypass mode)
    if (dangerouslySkipPermissions || codeMode === 'bypass') {
      claudeArgs.push('--dangerously-skip-permissions')
    }

    // Handle accept-edits mode: allow edit tools without prompting
    if (codeMode === 'accept-edits') {
      claudeArgs.push('--allowedTools', 'Edit,Write,MultiEdit,NotebookEdit')
    }

    // Add initial prompt as positional argument (claude "prompt")
    // Note: Do NOT use -p flag, that's for non-interactive "print and exit" mode
    // Note: Plan mode prefix (/plan) is handled by injecting into terminal, not here
    if (initialPrompt) {
      claudeArgs.push(initialPrompt)
    }

    // Spawn claude directly
    const claudePath = platform() === 'win32' ? 'claude' : `${homedir()}/.local/bin/claude`

    return {
      shell: claudePath,
      args: claudeArgs
    }
  }

  detectActivity(data: string, _current: ActivityState): ActivityState | null {
    // Thinking: spinner chars (braille patterns used by Claude CLI)
    if (/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/.test(data)) return 'thinking'

    // Tool use: tool name patterns in output
    if (/\b(Read|Write|Edit|Bash|Glob|Grep|Task|WebFetch|WebSearch)\s*[:\(]/.test(data)) return 'tool_use'

    // Awaiting input: Y/n permission prompts
    if (/\[Y\/n\]|\[y\/N\]/i.test(data)) return 'awaiting_input'

    // Idle: Claude's input prompt (> at start of line)
    // Strip ANSI escape codes first, then check for > at line start
    const stripped = data.replace(/\x1b\[[0-9;]*m/g, '')
    if (/(?:^|\n)>\s/m.test(stripped)) return 'idle'

    return null
  }

  detectError(data: string): ErrorInfo | null {
    // Session not found error
    if (/No conversation found with session ID:/.test(data)) {
      return {
        code: 'SESSION_NOT_FOUND',
        message: 'Session not found',
        recoverable: false
      }
    }

    // Generic CLI error
    const errorMatch = data.match(/Error:\s*(.+)/i)
    if (errorMatch) {
      return {
        code: 'CLI_ERROR',
        message: errorMatch[1].trim(),
        recoverable: true
      }
    }

    return null
  }

  detectPrompt(data: string): PromptInfo | null {
    // Y/n permission prompts
    if (/\[Y\/n\]|\[y\/N\]/i.test(data)) {
      return {
        type: 'permission',
        text: data,
        position: 0
      }
    }

    // Question detection (lines ending with ?)
    const questionMatch = data.match(/[^\n]*\?\s*$/m)
    if (questionMatch) {
      return {
        type: 'question',
        text: questionMatch[0].trim(),
        position: data.indexOf(questionMatch[0])
      }
    }

    return null
  }
}
