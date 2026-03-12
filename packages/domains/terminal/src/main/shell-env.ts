import { execFile } from 'child_process'
import fs from 'node:fs'
import { platform, userInfo } from 'os'
import { promisify } from 'util'
import type { ValidationResult } from './adapters/types'

const execFileAsync = promisify(execFile)

/** In-memory shell override — used by E2E tests via IPC, never persisted. */
let shellOverride: string | null = null

export function setShellOverride(value: string | null): void {
  shellOverride = value?.trim() || null
}

function shellExists(shellPath: string): boolean {
  if (platform() === 'win32') return fs.existsSync(shellPath)
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
 * 1) in-memory override (tests only)
 * 2) SHELL env var
 * 3) os.userInfo().shell
 * 4) platform fallback
 */
export function resolveUserShell(): string {
  if (shellOverride && shellExists(shellOverride)) return shellOverride

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
  const name = shell.split('/').pop() ?? shell
  if (name === 'zsh' || name === 'bash' || name === 'fish') {
    return ['-i', '-l']
  }

  return []
}

export function quoteForShell(arg: string): string {
  if (platform() === 'win32') {
    if (arg.length === 0) return '""'
    if (!/[\s"&|<>^%!]/.test(arg)) return arg
    return `"${arg.replace(/"/g, '""')}"`
  }
  if (arg.length === 0) return "''"
  return `'${arg.replace(/'/g, `'"'"'`)}'`
}

export function buildExecCommand(binary: string, args: string[] = []): string {
  const escaped = [binary, ...args].map(quoteForShell).join(' ')
  if (platform() === 'win32') return escaped
  return `exec ${escaped}`
}

/**
 * Check if shell environment is available for terminal launching.
 */
export function validateShellEnv(): ValidationResult {
  if (shellOverride && !shellExists(shellOverride)) {
    return {
      check: 'Shell detected',
      ok: false,
      detail: `Shell override not found: ${shellOverride}`,
      fix: 'Clear the shell override or set it to a valid absolute path'
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

/**
 * List CCS auth profiles by running `ccs auth list --json`.
 * Returns profile names or empty array if ccs not found / command fails.
 */
export async function listCcsProfiles(): Promise<string[]> {
  const ccsPath = await whichBinary('ccs')
  if (!ccsPath) return []

  try {
    const shell = resolveUserShell()
    const shellArgs = getShellStartupArgs(shell)
    const cmd = `${quoteForShell(ccsPath)} auth list --json`
    const { stdout } = await execFileAsync(shell, [...shellArgs, '-c', cmd], { timeout: 5000 })
    const parsed = JSON.parse(stdout.trim())
    if (Array.isArray(parsed?.profiles)) {
      return parsed.profiles.map((p: { name: string }) => p.name).filter(Boolean)
    }
    return []
  } catch {
    return []
  }
}
