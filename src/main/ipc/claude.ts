import { ipcMain, BrowserWindow } from 'electron'
import { spawn } from 'child_process'
import { streamClaude, cancelClaude } from '../services/claude-spawner'
import type { ClaudeAvailability } from '../../shared/types/api'

export function registerClaudeHandlers(): void {
  ipcMain.handle('claude:stream:start', (event, prompt: string, context?: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      streamClaude(win, prompt, context)
    }
  })

  ipcMain.on('claude:stream:cancel', () => {
    cancelClaude()
  })

  ipcMain.handle('claude:check-availability', async (): Promise<ClaudeAvailability> => {
    return new Promise((resolve) => {
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
  })
}
