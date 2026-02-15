import pkg from 'electron-updater'
const { autoUpdater } = pkg
import { is } from '@electron-toolkit/utils'

export function initAutoUpdater(): void {
  if (is.dev) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('error', (err) => console.error('[updater] error:', err.message))
  autoUpdater.on('update-available', (info) => console.log('[updater] update available:', info.version))
  autoUpdater.on('update-downloaded', (info) => console.log('[updater] downloaded:', info.version))

  autoUpdater.checkForUpdatesAndNotify()
}
