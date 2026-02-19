import { platform } from 'os'
import type { TerminalAdapter, SpawnConfig, PromptInfo, CodeMode, ActivityState, ErrorInfo, ValidationResult } from './types'
import { whichBinary } from '../shell-env'

/**
 * Adapter for OpenCode CLI.
 * Bubble Tea (Go) full-screen TUI — spawned via shell + postSpawnCommand like Codex.
 */
export class OpencodeAdapter implements TerminalAdapter {
  readonly mode = 'opencode' as const
  // Bubble Tea TUI updates in many small chunks; short idle timeout for completion
  readonly idleTimeoutMs = 2500
  // Full-screen TUI constantly redraws — detect working from user input, not output
  readonly transitionOnInput = true

  private getShell(override?: string): string {
    if (override) return override
    if (platform() === 'win32') {
      return process.env.COMSPEC || 'cmd.exe'
    }
    return process.env.SHELL || '/bin/bash'
  }

  private static shellEscape(arg: string): string {
    if (arg.length === 0) return "''"
    return `'${arg.replace(/'/g, `'\"'\"'`)}'`
  }

  buildSpawnConfig(_cwd: string, conversationId?: string, resuming?: boolean, shellOverride?: string, _initialPrompt?: string, providerArgs: string[] = [], _codeMode?: CodeMode): SpawnConfig {
    const binary = 'opencode'
    const escapedFlags = providerArgs.map((arg) => OpencodeAdapter.shellEscape(arg)).join(' ')

    const shouldResume = !!conversationId && !!resuming
    const baseCommand = shouldResume
      ? `${binary} --session ${OpencodeAdapter.shellEscape(conversationId)}`
      : binary

    const postSpawnCommand = escapedFlags.length > 0 ? `${baseCommand} ${escapedFlags}` : baseCommand

    return {
      shell: this.getShell(shellOverride),
      args: [],
      postSpawnCommand
    }
  }

  private static stripAnsi(data: string): string {
    return data
      .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '') // OSC sequences
      .replace(/\x1b\[[?0-9;:]*[ -/]*[@-~]/g, '')          // CSI sequences
      .replace(/\x1b[()][AB012]/g, '')                       // Character set
  }

  detectActivity(_data: string, _current: ActivityState): ActivityState | null {
    // Activity detected via transitionOnInput + idle timeout.
    // Output-based detection unreliable for Bubble Tea TUI that redraws constantly.
    return null
  }

  detectError(data: string): ErrorInfo | null {
    const stripped = OpencodeAdapter.stripAnsi(data)

    if (/Missing API key|Incorrect API key/i.test(stripped)) {
      return {
        code: 'AUTH_ERROR',
        message: 'API key missing or incorrect',
        recoverable: false
      }
    }

    if (/Unauthorized|Authentication Fails/i.test(stripped)) {
      return {
        code: 'AUTH_ERROR',
        message: 'Authentication failed',
        recoverable: false
      }
    }

    return null
  }

  async validate(): Promise<ValidationResult[]> {
    const found = await whichBinary('opencode')
    return [{
      check: 'Binary found',
      ok: !!found,
      detail: found ?? 'opencode not found in PATH',
      fix: found ? undefined : 'curl -fsSL https://opencode.ai/install | sh'
    }]
  }

  detectPrompt(_data: string): PromptInfo | null {
    // OpenCode TUI uses keyboard controls (a=Allow, d=Deny) rather than text prompts
    // TODO: Detect permission overlay if possible
    return null
  }
}
