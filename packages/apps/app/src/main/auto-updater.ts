import { dialog, app, BrowserWindow } from 'electron'
import { is } from '@electron-toolkit/utils'
// electron-updater is CJS. electron-vite v5 outputs ESM for main, and Node's
// CJS→ESM interop doesn't detect Object.defineProperty getters as named exports.
// A default import gives us the raw CJS exports object where the getter works.
import electronUpdater from 'electron-updater'

let autoUpdater: typeof electronUpdater.autoUpdater | null = null
let downloadedVersion: string | null = null

function getAutoUpdater() {
  if (!autoUpdater) {
    autoUpdater = electronUpdater.autoUpdater
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.on('error', (err) => console.error('[updater] error:', err.message))
    autoUpdater.on('update-available', (info) => console.log('[updater] update available:', info.version))
    autoUpdater.on('download-progress', (p) => {
      BrowserWindow.getAllWindows()[0]?.setProgressBar(p.percent / 100)
    })
    autoUpdater.on('update-downloaded', (info) => {
      console.log('[updater] downloaded:', info.version)
      downloadedVersion = info.version
      BrowserWindow.getAllWindows()[0]?.setProgressBar(-1)
    })
  }
  return autoUpdater
}

export function initAutoUpdater(): void {
  if (is.dev) return
  try {
    getAutoUpdater().checkForUpdatesAndNotify()
  } catch (err) {
    console.error('[updater] init failed:', err instanceof Error ? err.message : err)
  }
}

export async function checkForUpdates(): Promise<void> {
  if (is.dev) {
    dialog.showMessageBox({ message: 'Updates are not available in dev mode.', buttons: ['OK'] })
    return
  }

  try {
    const updater = getAutoUpdater()
    const result = await updater.checkForUpdates()
    if (!result || !result.updateInfo) {
      dialog.showMessageBox({ message: `You're on the latest version (${app.getVersion()}).`, buttons: ['OK'] })
      return
    }

    const { version } = result.updateInfo
    if (version === app.getVersion()) {
      dialog.showMessageBox({ message: `You're on the latest version (${app.getVersion()}).`, buttons: ['OK'] })
      return
    }

    // Wait for download (may already be done from startup auto-download)
    if (!downloadedVersion) {
      await new Promise<void>((resolve, reject) => {
        updater.once('update-downloaded', () => resolve())
        updater.once('error', (err) => reject(err))
      })
    }

    const { response } = await dialog.showMessageBox({
      message: `Update v${version} is ready`,
      detail: `Current version: v${app.getVersion()}`,
      buttons: ['Restart Now', 'Later'],
      defaultId: 0
    })

    if (response === 0) {
      updater.quitAndInstall()
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
