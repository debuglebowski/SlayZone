import { ipcMain } from 'electron'
import { spawn } from 'child_process'
import type { ClaudeAvailability } from '../../../shared/types/api'

export function registerClaudeHandlers(): void {
  ipcMain.handle('claude:check-availability', async (): Promise<ClaudeAvailability> => {
    const TIMEOUT_MS = 5000

    const checkPromise = new Promise<ClaudeAvailability>((resolve) => {
      const cmd = process.platform === 'win32' ? 'where' : 'which'
      const proc = spawn(cmd, ['claude'], { shell: true })

      let path = ''
      proc.stdout?.on('data', (data) => {
        path += data.toString().trim()
      })

      proc.on('close', (code) => {
        if (code !== 0 || !path) {
          resolve({ available: false, path: null, version: null })
          return
        }

        // Get version
        const versionProc = spawn('claude', ['--version'], { shell: true })
        let version = ''

        versionProc.stdout?.on('data', (data) => {
          version += data.toString().trim()
        })

        versionProc.on('close', () => {
          resolve({
            available: true,
            path: path.split('\n')[0],
            version: version || 'unknown'
          })
        })

        versionProc.on('error', () => {
          resolve({ available: true, path: path.split('\n')[0], version: 'unknown' })
        })
      })

      proc.on('error', () => {
        resolve({ available: false, path: null, version: null })
      })
    })

    const timeoutPromise = new Promise<ClaudeAvailability>((resolve) => {
      setTimeout(() => {
        resolve({ available: false, path: null, version: null })
      }, TIMEOUT_MS)
    })

    return Promise.race([checkPromise, timeoutPromise])
  })
}
