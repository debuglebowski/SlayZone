import { BrowserWindow } from 'electron'
import type { IpcMain } from 'electron'
import type { Database } from 'better-sqlite3'
import { createPty, writePty, resizePty, killPty, hasPty, getBuffer, clearBuffer, getBufferSince, listPtys, getState, setDatabase, dismissAllNotifications } from './pty-manager'
import { getAdapter, type TerminalMode } from './adapters'
import type { CodeMode } from '@slayzone/terminal/shared'
import { parseShellArgs } from './adapters/flag-parser'
import { setShellOverrideProvider } from './shell-env'

export function registerPtyHandlers(ipcMain: IpcMain, db: Database): void {
  // Set database reference for notifications
  setDatabase(db)
  setShellOverrideProvider(() => {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('shell') as { value: string } | undefined
    const value = row?.value?.trim()
    return value ? value : null
  })

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
      providerFlags?: string | null
    ) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return { success: false, error: 'No window found' }

      let providerArgs: string[] = []
      try {
        providerArgs = parseShellArgs(providerFlags)
      } catch (err) {
        console.warn('[pty:create] Invalid provider flags, ignoring:', (err as Error).message)
      }

      return createPty(win, sessionId, cwd, conversationId, existingConversationId, mode, initialPrompt, providerArgs, codeMode)
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

  ipcMain.handle('pty:clearBuffer', (_, sessionId: string) => {
    return clearBuffer(sessionId)
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

  ipcMain.handle('pty:dismissAllNotifications', () => {
    dismissAllNotifications()
  })

  ipcMain.handle('pty:validate', async (_, mode: TerminalMode) => {
    const adapter = getAdapter(mode)
    return adapter.validate ? adapter.validate() : []
  })
}
