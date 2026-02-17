import type { IpcMain } from 'electron'
import { spawn } from 'child_process'
import type { ClaudeAvailability } from '@slayzone/terminal/shared'

export function registerClaudeHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('claude:check-availability', async (): Promise<ClaudeAvailability> => {
    const TIMEOUT_MS = 5000

    const checkPromise = new Promise<ClaudeAvailability>((resolve) => {
      const proc = spawn('claude', ['--version'])

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

    const timeoutPromise = new Promise<ClaudeAvailability>((resolve) => {
      setTimeout(() => {
        resolve({ available: false, version: null })
      }, TIMEOUT_MS)
    })

    return Promise.race([checkPromise, timeoutPromise])
  })
}
