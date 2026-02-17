import pkg from 'electron-updater'
const { autoUpdater } = pkg
import { dialog, app } from 'electron'
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

export async function checkForUpdates(): Promise<void> {
  if (is.dev) {
    dialog.showMessageBox({ message: 'Updates are not available in dev mode.', buttons: ['OK'] })
    return
  }

  try {
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
