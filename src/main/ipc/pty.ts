import { ipcMain, BrowserWindow } from 'electron'
import { createPty, writePty, resizePty, killPty, hasPty, getBuffer, listPtys, getState } from '../services/pty-manager'
import { getDatabase } from '../db'
import type { TerminalMode } from '../services/adapters'

export function registerPtyHandlers(): void {
  ipcMain.handle(
    'pty:create',
    (
      event,
      taskId: string,
      cwd: string,
      sessionId?: string | null,
      existingSessionId?: string | null,
      mode?: TerminalMode,
      initialPrompt?: string | null
    ) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return { success: false, error: 'No window found' }

      // Read global shell setting from DB
      const db = getDatabase()
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('shell') as { value: string } | undefined
      const globalShell = row?.value || null

      return createPty(win, taskId, cwd, sessionId, existingSessionId, mode, globalShell, initialPrompt)
    }
  )

  ipcMain.handle('pty:write', (_, taskId: string, data: string) => {
    return writePty(taskId, data)
  })

  ipcMain.handle('pty:resize', (_, taskId: string, cols: number, rows: number) => {
    return resizePty(taskId, cols, rows)
  })

  ipcMain.handle('pty:kill', (_, taskId: string) => {
    return killPty(taskId)
  })

  ipcMain.handle('pty:exists', (_, taskId: string) => {
    return hasPty(taskId)
  })

  ipcMain.handle('pty:getBuffer', (_, taskId: string) => {
    return getBuffer(taskId)
  })

  ipcMain.handle('pty:list', () => {
    return listPtys()
  })

  ipcMain.handle('pty:getState', (_, taskId: string) => {
    return getState(taskId)
  })
}
