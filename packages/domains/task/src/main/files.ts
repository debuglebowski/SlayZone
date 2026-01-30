import type { IpcMain } from 'electron'
import { app } from 'electron'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

export function registerFilesHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('files:saveTempImage', async (_, base64: string, mimeType: string) => {
    try {
      const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/gif' ? 'gif' : 'jpg'
      const filename = `paste-${randomUUID()}.${ext}`
      const tempDir = join(app.getPath('temp'), 'omgslayzone')

      await mkdir(tempDir, { recursive: true })
      const filepath = join(tempDir, filename)

      const buffer = Buffer.from(base64, 'base64')
      await writeFile(filepath, buffer)

      return { success: true, path: filepath }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })
}
