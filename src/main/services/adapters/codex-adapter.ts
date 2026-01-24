import { platform } from 'os'
import type { TerminalState } from '../../../shared/types/api'
import type { TerminalAdapter, SpawnConfig, PromptInfo, StructuredEvent } from './types'

/**
 * Adapter for OpenAI Codex CLI.
 * Stub implementation - to be fleshed out when Codex CLI details are known.
 */
export class CodexAdapter implements TerminalAdapter {
  readonly mode = 'codex' as const

  private getShell(override?: string): string {
    if (override) return override
    if (platform() === 'win32') {
      return process.env.COMSPEC || 'cmd.exe'
    }
    return process.env.SHELL || '/bin/bash'
  }

  buildSpawnConfig(_cwd: string, _conversationId?: string, _resuming?: boolean, shellOverride?: string): SpawnConfig {
    // Codex CLI doesn't support session resume - always start fresh
    return {
      shell: this.getShell(shellOverride),
      args: [],
      postSpawnCommand: 'codex'
    }
  }

  detectPrompt(_data: string): PromptInfo | null {
    // TODO: Implement when Codex output format is known
    return null
  }

  parseEvent(_data: string): StructuredEvent | null {
    // TODO: Implement when Codex output format is known
    return null
  }

  detectState(_data: string, _currentState: TerminalState): TerminalState | null {
    // TODO: Implement when Codex output format is known
    return null
  }
}
