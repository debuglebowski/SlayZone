import { ipcMain, app, BrowserWindow } from 'electron'
import { randomUUID } from 'crypto'
import { join } from 'path'
import { mkdirSync, writeFileSync } from 'fs'

export function registerScreenshotHandlers(): void {
  ipcMain.handle(
    'screenshot:captureRegion',
    async (event, rect: { x: number; y: number; width: number; height: number }) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return { success: false }

      // Account for device pixel ratio (Retina)
      const scaleFactor = win.webContents.getZoomFactor()
      const captureRect = {
        x: Math.round(rect.x * scaleFactor),
        y: Math.round(rect.y * scaleFactor),
        width: Math.round(rect.width * scaleFactor),
        height: Math.round(rect.height * scaleFactor)
      }

      const image = await win.webContents.capturePage(captureRect)
      if (image.isEmpty()) return { success: false }

      const dir = join(app.getPath('temp'), 'slayzone')
      mkdirSync(dir, { recursive: true })
      const filePath = join(dir, `${randomUUID()}.png`)
      writeFileSync(filePath, image.toPNG())

      return { success: true, path: filePath }
    }
  )
}
