import { nativeTheme, BrowserWindow } from 'electron'
import type { IpcMain } from 'electron'
import type { Database } from 'better-sqlite3'

export function registerThemeHandlers(ipcMain: IpcMain, db: Database): void {

  // Get current effective theme (what's actually showing)
  ipcMain.handle('theme:get-effective', () => {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  })

  // Get user's preference (light/dark)
  ipcMain.handle('theme:get-source', () => {
    return nativeTheme.themeSource === 'light' ? 'light' : 'dark'
  })

  // Set theme preference
  ipcMain.handle('theme:set', (_, theme: 'light' | 'dark') => {
    nativeTheme.themeSource = theme
    // Persist to database
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('theme', theme)
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  })

  // Notify renderer windows whenever Electron reports a theme update.
  nativeTheme.on('updated', () => {
    const effective = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
    // Notify all windows
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('theme:changed', effective)
    })
  })
}
