import type { IpcMain } from 'electron'
import { spawn } from 'child_process'
import { homedir, platform } from 'os'
import { existsSync } from 'fs'
import { join } from 'path'
import { shellPath } from 'shell-path'
import type { ClaudeAvailability } from '@slayzone/terminal/shared'

// Resolve user's shell PATH once (lazy, cached)
let resolvedPath: Promise<string | null> | null = null
function getShellPath(): Promise<string | null> {
  if (!resolvedPath) {
    resolvedPath = shellPath().catch(() => null)
  }
  return resolvedPath
}

// shellPath() uses the login shell (e.g. zsh) which may not include dirs
// added by the user's interactive shell (e.g. fish). Append common locations.
const COMMON_BIN_DIRS = [
  join(homedir(), '.local', 'bin'),
  '/usr/local/bin',
  '/opt/homebrew/bin',
]

function enrichPath(basePath: string): string {
  const dirs = basePath.split(':')
  for (const dir of COMMON_BIN_DIRS) {
    if (!dirs.includes(dir)) dirs.push(dir)
  }
  return dirs.join(':')
}

function checkClaude(env: NodeJS.ProcessEnv): Promise<ClaudeAvailability> {
  return new Promise((resolve) => {
    // Prefer full path — most reliable for GUI-launched apps
    const fullPath = platform() === 'win32' ? null : join(homedir(), '.local', 'bin', 'claude')
    const cmd = fullPath && existsSync(fullPath) ? fullPath : 'claude'

    const proc = spawn(cmd, ['--version'], { shell: true, env })

    let version = ''
    proc.stdout?.on('data', (data) => {
      version += data.toString().trim()
    })

    proc.on('close', (code) => {
      if (code !== 0 || !version) {
        resolve({ available: false, version: null })
      } else {
        resolve({ available: true, version })
      }
    })

    proc.on('error', () => {
      resolve({ available: false, version: null })
    })
  })
}

export function registerClaudeHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('claude:check-availability', async (): Promise<ClaudeAvailability> => {
    const TIMEOUT_MS = 5000

    const path = await getShellPath()
    const basePath = path || process.env.PATH || ''
    const env = { ...process.env, PATH: enrichPath(basePath) }

    const timeoutPromise = new Promise<ClaudeAvailability>((resolve) => {
      setTimeout(() => resolve({ available: false, version: null }), TIMEOUT_MS)
    })

    return Promise.race([checkClaude(env), timeoutPromise])
  })
}
