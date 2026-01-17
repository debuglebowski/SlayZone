import { nativeTheme, ipcMain, BrowserWindow } from 'electron'
import { getDatabase } from '../db'

export function registerThemeHandlers(): void {
  const db = getDatabase()

  // Get current effective theme (what's actually showing)
  ipcMain.handle('theme:get-effective', () => {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  })

  // Get user's preference (light/dark/system)
  ipcMain.handle('theme:get-source', () => {
    return nativeTheme.themeSource
  })

  // Set theme preference
  ipcMain.handle('theme:set', (_, theme: 'light' | 'dark' | 'system') => {
    nativeTheme.themeSource = theme
    // Persist to database
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('theme', theme)
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  })

  // Listen for OS theme changes (only matters when themeSource is 'system')
  nativeTheme.on('updated', () => {
    const effective = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
    // Notify all windows
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('theme:changed', effective)
    })
  })
}
