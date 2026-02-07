import { platform } from 'os'
import type { TerminalAdapter, SpawnConfig, PromptInfo, CodeMode, ActivityState, ErrorInfo } from './types'

/**
 * Adapter for OpenAI Codex CLI.
 * Codex uses a full-screen Ratatui TUI. State detection is binary:
 * working (shows interrupt/cancel hints) vs attention (idle timeout fallback).
 */
export class CodexAdapter implements TerminalAdapter {
  readonly mode = 'codex' as const
  // Codex TUI updates in many small chunks, so we keep "working" latched and
  // let a short idle timeout decide when activity has stopped.
  readonly idleTimeoutMs = 2500

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
    const escapedFlags = providerArgs.map((arg) => CodexAdapter.shellEscape(arg)).join(' ')
    const shouldResume = !!conversationId && !!resuming
    const baseCommand = shouldResume
      ? `codex resume ${CodexAdapter.shellEscape(conversationId)}`
      : 'codex'
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
      .replace(/\x1b\[[?0-9;:]*[ -/]*[@-~]/g, '')            // CSI sequences
      .replace(/\x1b[()][AB012]/g, '')            // Character set
  }

  private static normalizeText(data: string): string {
    return data.replace(/\s+/g, ' ').trim()
  }

  private static hasWorkingIndicator(text: string): boolean {
    return /\b(?:esc|escape)\s+to\s+(?:interrupt|cancel|stop)\b/i.test(text)
      || /\b(?:ctrl\s*\+\s*c|control-c)\s+to\s+(?:interrupt|cancel|stop)\b/i.test(text)
  }

  detectActivity(data: string, current: ActivityState): ActivityState | null {
    const stripped = CodexAdapter.normalizeText(CodexAdapter.stripAnsi(data))

    // Codex shows an interrupt hint while the agent is actively working.
    // This can arrive fragmented across many redraw chunks, so when we are
    // already in "working", don't force "attention" on non-matching chunks.
    if (CodexAdapter.hasWorkingIndicator(stripped)) return 'working'

    if (current === 'working') return null

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
