import { platform } from 'os'
import type { TerminalAdapter, SpawnConfig, PromptInfo, CodeMode, ActivityState, ErrorInfo } from './types'

/**
 * Adapter for OpenAI Codex CLI.
 * Codex uses a full-screen Ratatui TUI. State detection is binary:
 * working (shows "esc to interrupt") vs attention (everything else).
 */
export class CodexAdapter implements TerminalAdapter {
  readonly mode = 'codex' as const
  readonly idleTimeoutMs = null // use default 60s

  private getShell(override?: string): string {
    if (override) return override
    if (platform() === 'win32') {
      return process.env.COMSPEC || 'cmd.exe'
    }
    return process.env.SHELL || '/bin/bash'
  }

  buildSpawnConfig(_cwd: string, _conversationId?: string, _resuming?: boolean, shellOverride?: string, _initialPrompt?: string, _dangerouslySkipPermissions?: boolean, _codeMode?: CodeMode): SpawnConfig {
    // Codex CLI doesn't support session resume - always start fresh
    return {
      shell: this.getShell(shellOverride),
      args: [],
      postSpawnCommand: 'codex'
    }
  }

  private static stripAnsi(data: string): string {
    return data
      .replace(/\x1b\][^\x07]*\x07/g, '')       // OSC sequences
      .replace(/\x1b\[[?0-9;]*[A-Za-z]/g, '')    // CSI (including ?)
      .replace(/\x1b[()][AB012]/g, '')            // Character set
  }

  detectActivity(data: string, current: ActivityState): ActivityState | null {
    const stripped = CodexAdapter.stripAnsi(data)

    // "esc to interrupt" appears in Codex's TUI while working
    if (/esc to interrupt/i.test(stripped)) return 'working'

    // If currently working and we get output without the indicator, work finished
    if (current === 'working' && stripped.replace(/\s/g, '').length > 0) return 'attention'

    return null
  }

  detectError(_data: string): ErrorInfo | null {
    // TODO: Implement when Codex output format is known
    return null
  }

  detectPrompt(_data: string): PromptInfo | null {
    // TODO: Implement when Codex output format is known
    return null
  }
}
