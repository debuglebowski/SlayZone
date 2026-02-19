import { execFile } from 'child_process'
import fs from 'node:fs'
import { platform, userInfo } from 'os'
import { promisify } from 'util'
import type { ValidationResult } from './adapters/types'

const execFileAsync = promisify(execFile)

type ShellOverrideProvider = () => string | null

let shellOverrideProvider: ShellOverrideProvider | null = null

export function setShellOverrideProvider(provider: ShellOverrideProvider | null): void {
  shellOverrideProvider = provider
}

function getConfiguredShellOverride(): string | null {
  if (!shellOverrideProvider) return null
  try {
    const value = shellOverrideProvider()?.trim()
    return value ? value : null
  } catch {
    return null
  }
}

function shellExists(shellPath: string): boolean {
  if (platform() === 'win32') return true
  try {
    fs.accessSync(shellPath, fs.constants.X_OK)
    return true
  } catch {
    return false
  }
}

function defaultShellForPlatform(): string {
  if (platform() === 'win32') return process.env.COMSPEC || 'cmd.exe'
  if (platform() === 'darwin') return '/bin/zsh'
  return '/bin/bash'
}

/**
 * Resolve the shell used to launch terminal sessions.
 * Priority:
 * 1) settings override (`shell`)
 * 2) SHELL env var
 * 3) os.userInfo().shell
 * 4) platform fallback
 */
export function resolveUserShell(): string {
  const configured = getConfiguredShellOverride()
  if (configured) return configured

  const fromEnv = process.env.SHELL?.trim()
  if (fromEnv && shellExists(fromEnv)) return fromEnv

  try {
    const fromUser = userInfo().shell?.trim()
    if (fromUser && shellExists(fromUser)) return fromUser
  } catch {
    // ignore userInfo lookup failures
  }

  return defaultShellForPlatform()
}

/**
 * Backwards-compatible alias used by existing adapters.
 */
export function getDefaultShell(): string {
  return resolveUserShell()
}

/**
 * Startup args used to emulate typical interactive login terminal behavior.
 */
export function getShellStartupArgs(shellPath: string): string[] {
  if (platform() === 'win32') return []

  const shell = shellPath.toLowerCase()
  if (shell.endsWith('/zsh') || shell.endsWith('/bash') || shell.endsWith('/fish')) {
    return ['-i', '-l']
  }

  return []
}

export function quoteForShell(arg: string): string {
  if (arg.length === 0) return "''"
  return `'${arg.replace(/'/g, `'"'"'`)}'`
}

export function buildExecCommand(binary: string, args: string[] = []): string {
  const escaped = [binary, ...args].map(quoteForShell).join(' ')
  return `exec ${escaped}`
}

/**
 * Check if shell environment is available for terminal launching.
 */
export function validateShellEnv(): ValidationResult {
  const configured = getConfiguredShellOverride()
  if (configured && !shellExists(configured)) {
    return {
      check: 'Shell detected',
      ok: false,
      detail: `Configured shell not found: ${configured}`,
      fix: 'Clear advanced shell override or set it to a valid shell path'
    }
  }

  const shell = resolveUserShell()
  if (!shell) {
    return {
      check: 'Shell detected',
      ok: false,
      detail: 'No usable shell detected',
      fix: 'Set SHELL to a valid shell path (for example /bin/zsh)'
    }
  }

  return { check: 'Shell detected', ok: true, detail: shell }
}

/**
 * Find a binary by name using the same shell startup context as PTY sessions.
 * Returns the resolved path or null if not found.
 */
export async function whichBinary(name: string): Promise<string | null> {
  if (platform() === 'win32') {
    try {
      const { stdout } = await execFileAsync('where', [name], { timeout: 3000 })
      const found = stdout.trim().split('\n')[0]
      return found || null
    } catch {
      return null
    }
  }

  try {
    const shell = resolveUserShell()
    const shellArgs = getShellStartupArgs(shell)
    const checkCmd = `command -v ${quoteForShell(name)}`
    const { stdout } = await execFileAsync(shell, [...shellArgs, '-c', checkCmd], { timeout: 3000 })
    const found = stdout.trim().split('\n')[0]
    return found || null
  } catch {
    return null
  }
}
