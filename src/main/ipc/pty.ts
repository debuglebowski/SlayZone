import { ipcMain, BrowserWindow } from 'electron'
import { createPty, writePty, resizePty, killPty, hasPty } from '../services/pty-manager'

export function registerPtyHandlers(): void {
  ipcMain.handle(
    'pty:create',
    (
      event,
      taskId: string,
      cwd: string,
      sessionId?: string | null,
      existingSessionId?: string | null
    ) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return { success: false, error: 'No window found' }
      return createPty(win, taskId, cwd, sessionId, existingSessionId)
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
}
