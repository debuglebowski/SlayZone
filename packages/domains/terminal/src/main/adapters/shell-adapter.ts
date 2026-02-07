import { platform } from 'os'
import type { TerminalAdapter, SpawnConfig, PromptInfo, CodeMode, ActivityState, ErrorInfo } from './types'

/**
 * Adapter for raw terminal/shell.
 * Passthrough with no special parsing or prompt detection.
 */
export class ShellAdapter implements TerminalAdapter {
  readonly mode = 'terminal' as const
  readonly idleTimeoutMs = null // use default 60s

  private getShell(override?: string): string {
    if (override) return override
    if (platform() === 'win32') {
      return process.env.COMSPEC || 'cmd.exe'
    }
    return process.env.SHELL || '/bin/bash'
  }

  buildSpawnConfig(_cwd: string, _conversationId?: string, _resuming?: boolean, shellOverride?: string, _initialPrompt?: string, _providerArgs?: string[], _codeMode?: CodeMode): SpawnConfig {
    return {
      shell: this.getShell(shellOverride),
      args: []
    }
  }

  detectActivity(_data: string, _current: ActivityState): ActivityState | null {
    // Raw terminal has no activity detection
    return null
  }

  detectError(_data: string): ErrorInfo | null {
    // Raw terminal has no error detection
    return null
  }

  detectPrompt(_data: string): PromptInfo | null {
    // Raw terminal has no prompt detection
    return null
  }
}
