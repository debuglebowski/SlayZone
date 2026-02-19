import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

let cachedShellPath: string | null = null

/**
 * Get the user's login shell PATH (handles nvm, homebrew, etc.).
 * Electron launched from the dock inherits a minimal PATH — this resolves
 * the full PATH by running a login shell once and caching the result.
 */
export async function getUserShellPath(): Promise<string> {
  if (cachedShellPath !== null) return cachedShellPath
  try {
    const shell = process.env.SHELL || '/bin/zsh'
    const isFish = shell.endsWith('/fish') || shell === 'fish'
    const isBashOrZsh = /\/(bash|zsh)$/.test(shell)
    if (!isFish && !isBashOrZsh) {
      console.warn(`[shell-env] Unsupported shell: ${shell}. PATH enrichment may not work correctly.`)
    }
    // Fish: use -i (interactive) so config guarded by `status is-interactive` runs.
    // bash/zsh: use -l (login) so .bash_profile/.zprofile runs.
    const cmd = isFish
      ? `${shell} -i -c 'string join ":" $PATH'`
      : `${shell} -l -c 'echo $PATH'`
    const { stdout } = await execAsync(cmd, { timeout: 3000 })
    // Take last line: fish may print fish_greeting before the PATH output
    cachedShellPath = stdout.trim().split('\n').at(-1) ?? ''
  } catch {
    cachedShellPath = process.env.PATH || ''
  }
  return cachedShellPath
}

/**
 * Find a binary by name using the enriched login shell PATH.
 * Returns the resolved path or null if not found.
 */
export async function whichBinary(name: string): Promise<string | null> {
  try {
    const shellPath = await getUserShellPath()
    const cmd = process.platform === 'win32' ? `where ${name}` : `which ${name}`
    const { stdout } = await execAsync(cmd, {
      env: { ...process.env, PATH: shellPath },
      timeout: 3000
    })
    const found = stdout.trim().split('\n')[0]
    return found || null
  } catch {
    return null
  }
}
