import { ipcMain, BrowserWindow } from 'electron'
import { streamClaude, cancelClaude } from '../services/claude-spawner'

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
}
