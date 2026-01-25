import { platform } from 'os'
import type { TerminalState } from '../../../shared/types/api'
import type { TerminalAdapter, SpawnConfig, PromptInfo, StructuredEvent } from './types'

/**
 * Adapter for raw terminal/shell.
 * Passthrough with no special parsing or prompt detection.
 */
export class ShellAdapter implements TerminalAdapter {
  readonly mode = 'terminal' as const

  private getShell(override?: string): string {
    if (override) return override
    if (platform() === 'win32') {
      return process.env.COMSPEC || 'cmd.exe'
    }
    return process.env.SHELL || '/bin/bash'
  }

  buildSpawnConfig(_cwd: string, _conversationId?: string, _resuming?: boolean, shellOverride?: string, _initialPrompt?: string): SpawnConfig {
    return {
      shell: this.getShell(shellOverride),
      args: []
    }
  }

  detectPrompt(_data: string): PromptInfo | null {
    // Raw terminal has no special prompt detection
    return null
  }

  parseEvent(_data: string): StructuredEvent | null {
    // Raw terminal has no structured events
    return null
  }

  detectState(_data: string, _currentState: TerminalState): TerminalState | null {
    // Raw terminal uses basic heuristics only (handled in pty-manager)
    return null
  }
}
