import { dialog, app } from 'electron'
import { is } from '@electron-toolkit/utils'

// Lazy-loaded to avoid blocking startup
let _autoUpdater: typeof import('electron-updater').autoUpdater | null = null
async function getAutoUpdater() {
  if (!_autoUpdater) {
    const pkg = await import('electron-updater')
    _autoUpdater = pkg.autoUpdater
    _autoUpdater.autoDownload = false
    _autoUpdater.autoInstallOnAppQuit = true
    _autoUpdater.on('error', (err) => console.error('[updater] error:', err.message))
    _autoUpdater.on('update-available', (info) => console.log('[updater] update available:', info.version))
    _autoUpdater.on('update-downloaded', (info) => console.log('[updater] downloaded:', info.version))
  }
  return _autoUpdater
}

export async function initAutoUpdater(): Promise<void> {
  if (is.dev) return
  const autoUpdater = await getAutoUpdater()
  autoUpdater.checkForUpdatesAndNotify()
}

export async function checkForUpdates(): Promise<void> {
  if (is.dev) {
    dialog.showMessageBox({ message: 'Updates are not available in dev mode.', buttons: ['OK'] })
    return
  }

  try {
    const autoUpdater = await getAutoUpdater()
    const result = await autoUpdater.checkForUpdates()
    if (!result || !result.updateInfo) {
      dialog.showMessageBox({ message: `You're on the latest version (${app.getVersion()}).`, buttons: ['OK'] })
      return
    }

    const { version } = result.updateInfo
    if (version === app.getVersion()) {
      dialog.showMessageBox({ message: `You're on the latest version (${app.getVersion()}).`, buttons: ['OK'] })
      return
    }

    const { response } = await dialog.showMessageBox({
      message: `Update available: v${version}`,
      detail: `Current version: v${app.getVersion()}. The update will be installed on restart.`,
      buttons: ['Restart Now', 'Later'],
      defaultId: 0
    })

    if (response === 0) {
      autoUpdater.quitAndInstall()
    }
  } catch (err) {
    dialog.showMessageBox({
      type: 'error',
      message: 'Update check failed',
      detail: err instanceof Error ? err.message : String(err),
      buttons: ['OK']
    })
  }
}
