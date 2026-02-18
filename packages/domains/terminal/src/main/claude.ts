import type { IpcMain } from 'electron'
import { spawn } from 'child_process'
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

function checkClaude(env: NodeJS.ProcessEnv): Promise<ClaudeAvailability> {
  return new Promise((resolve) => {
    const proc = spawn('claude', ['--version'], { shell: true, env })

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
    const env = path ? { ...process.env, PATH: path } : process.env

    const timeoutPromise = new Promise<ClaudeAvailability>((resolve) => {
      setTimeout(() => resolve({ available: false, version: null }), TIMEOUT_MS)
    })

    return Promise.race([checkClaude(env), timeoutPromise])
  })
}
