import type { TerminalAdapter, SpawnConfig, PromptInfo, CodeMode, ActivityState, ErrorInfo, ValidationResult } from './types'
import { buildExecCommand, getShellStartupArgs, resolveUserShell, whichBinary, validateShellEnv } from '../shell-env'

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
  readonly sessionIdCommand = '/status'

  buildSpawnConfig(_cwd: string, conversationId?: string, resuming?: boolean, _initialPrompt?: string, providerArgs: string[] = [], _codeMode?: CodeMode): SpawnConfig {
    const cmdArgs: string[] = []
    const shouldResume = !!conversationId && !!resuming

    if (shouldResume) {
      cmdArgs.push('resume', conversationId)
    }

    cmdArgs.push(...providerArgs)

    const shell = resolveUserShell()
    return {
      shell,
      args: getShellStartupArgs(shell),
      postSpawnCommand: buildExecCommand('codex', cmdArgs)
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

  async validate(): Promise<ValidationResult[]> {
    const [shell, node, codex] = await Promise.all([validateShellEnv(), whichBinary('node'), whichBinary('codex')])
    const results: ValidationResult[] = []
    if (!shell.ok) results.push(shell)
    results.push(
      {
        check: 'Node.js found',
        ok: !!node,
        detail: node ?? 'node not found in PATH',
        fix: node ? undefined : 'Install Node.js from https://nodejs.org'
      },
      {
        check: 'Codex CLI found',
        ok: !!codex,
        detail: codex ?? 'codex not found in PATH',
        fix: codex ? undefined : 'npm install -g @openai/codex'
      }
    )
    return results
  }

  detectPrompt(_data: string): PromptInfo | null {
    // TODO: Implement when Codex output format is known
    return null
  }
}
