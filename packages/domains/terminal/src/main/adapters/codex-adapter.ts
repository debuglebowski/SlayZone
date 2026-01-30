import { platform } from 'os'
import type { TerminalAdapter, SpawnConfig, PromptInfo, CodeMode, ActivityState, ErrorInfo } from './types'

/**
 * Adapter for OpenAI Codex CLI.
 * Stub implementation - to be fleshed out when Codex CLI details are known.
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

  detectActivity(_data: string, _current: ActivityState): ActivityState | null {
    // TODO: Implement when Codex output format is known
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
