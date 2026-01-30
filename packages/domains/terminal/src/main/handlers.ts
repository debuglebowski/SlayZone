import { BrowserWindow } from 'electron'
import type { IpcMain } from 'electron'
import type { Database } from 'better-sqlite3'
import { createPty, writePty, resizePty, killPty, hasPty, getBuffer, listPtys, getState } from './pty-manager'
import type { TerminalMode } from './adapters'
import type { CodeMode } from '@omgslayzone/terminal/shared'

export function registerPtyHandlers(ipcMain: IpcMain, db: Database): void {
  ipcMain.handle(
    'pty:create',
    (
      event,
      taskId: string,
      cwd: string,
      sessionId?: string | null,
      existingSessionId?: string | null,
      mode?: TerminalMode,
      initialPrompt?: string | null,
      codeMode?: CodeMode | null
    ) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return { success: false, error: 'No window found' }

      // Read global shell setting from DB
      const shellRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('shell') as { value: string } | undefined
      const globalShell = shellRow?.value || null

      // Read task-specific dangerously_skip_permissions flag (override by codeMode if provided)
      const taskRow = db.prepare('SELECT dangerously_skip_permissions FROM tasks WHERE id = ?').get(taskId) as { dangerously_skip_permissions: boolean } | undefined
      const dangerouslySkipPermissions = codeMode === 'bypass' || (taskRow?.dangerously_skip_permissions ?? false)

      return createPty(win, taskId, cwd, sessionId, existingSessionId, mode, globalShell, initialPrompt, dangerouslySkipPermissions, codeMode)
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
