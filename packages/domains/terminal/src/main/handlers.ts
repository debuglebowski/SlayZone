import { BrowserWindow } from 'electron'
import type { IpcMain } from 'electron'
import type { Database } from 'better-sqlite3'
import { createPty, writePty, resizePty, killPty, hasPty, getBuffer, getBufferSince, listPtys, getState, setDatabase } from './pty-manager'
import type { TerminalMode } from './adapters'
import type { CodeMode } from '@slayzone/terminal/shared'

export function registerPtyHandlers(ipcMain: IpcMain, db: Database): void {
  // Set database reference for notifications
  setDatabase(db)

  ipcMain.handle(
    'pty:create',
    (
      event,
      sessionId: string,
      cwd: string,
      conversationId?: string | null,
      existingConversationId?: string | null,
      mode?: TerminalMode,
      initialPrompt?: string | null,
      codeMode?: CodeMode | null,
      dangerouslySkipPermissionsOverride?: boolean
    ) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return { success: false, error: 'No window found' }

      // Read global shell setting from DB
      const shellRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('shell') as { value: string } | undefined
      const globalShell = shellRow?.value || null

      // Use override if provided, otherwise default to false
      const dangerouslySkipPermissions = codeMode === 'bypass' || (dangerouslySkipPermissionsOverride ?? false)

      return createPty(win, sessionId, cwd, conversationId, existingConversationId, mode, globalShell, initialPrompt, dangerouslySkipPermissions, codeMode)
    }
  )

  ipcMain.handle('pty:write', (_, sessionId: string, data: string) => {
    return writePty(sessionId, data)
  })

  ipcMain.handle('pty:resize', (_, sessionId: string, cols: number, rows: number) => {
    return resizePty(sessionId, cols, rows)
  })

  ipcMain.handle('pty:kill', (_, sessionId: string) => {
    return killPty(sessionId)
  })

  ipcMain.handle('pty:exists', (_, sessionId: string) => {
    return hasPty(sessionId)
  })

  ipcMain.handle('pty:getBuffer', (_, sessionId: string) => {
    return getBuffer(sessionId)
  })

  ipcMain.handle('pty:getBufferSince', (_, sessionId: string, afterSeq: number) => {
    return getBufferSince(sessionId, afterSeq)
  })

  ipcMain.handle('pty:list', () => {
    return listPtys()
  })

  ipcMain.handle('pty:getState', (_, sessionId: string) => {
    return getState(sessionId)
  })
}
