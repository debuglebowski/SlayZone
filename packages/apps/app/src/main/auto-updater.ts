import { app, BrowserWindow } from 'electron'
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
      const win = BrowserWindow.getAllWindows()[0]
      win?.setProgressBar(-1)
      win?.webContents.send('app:update-status', { type: 'downloaded', version: info.version })
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

export function restartForUpdate(): void {
  if (autoUpdater) autoUpdater.quitAndInstall()
}

function sendUpdateStatus(status: import('@slayzone/types').UpdateStatus): void {
  BrowserWindow.getAllWindows()[0]?.webContents.send('app:update-status', status)
}

export async function checkForUpdates(): Promise<void> {
  sendUpdateStatus({ type: 'checking' })

  if (is.dev) {
    sendUpdateStatus({ type: 'not-available' })
    return
  }

  try {
    const updater = getAutoUpdater()

    // If already downloaded, just re-notify renderer
    if (downloadedVersion) {
      sendUpdateStatus({ type: 'downloaded', version: downloadedVersion })
      return
    }

    const result = await updater.checkForUpdates()
    if (!result || !result.updateInfo || result.updateInfo.version === app.getVersion()) {
      sendUpdateStatus({ type: 'not-available' })
      return
    }

    // Download in progress — the 'update-downloaded' handler will notify renderer
  } catch (err) {
    sendUpdateStatus({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}
