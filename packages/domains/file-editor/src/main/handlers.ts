import * as fs from 'node:fs'
import * as path from 'node:path'
import type { IpcMain } from 'electron'
import type { DirEntry } from '../shared'

const IGNORED = new Set(['.git', 'node_modules', '.DS_Store'])

function assertWithinRoot(root: string, target: string): string {
  const resolved = path.resolve(root, target)
  if (!resolved.startsWith(path.resolve(root) + path.sep) && resolved !== path.resolve(root)) {
    throw new Error('Path traversal denied')
  }
  return resolved
}

export function registerFileEditorHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('fs:readDir', (_event, rootPath: string, dirPath: string): DirEntry[] => {
    const abs = dirPath ? assertWithinRoot(rootPath, dirPath) : path.resolve(rootPath)
    const entries = fs.readdirSync(abs, { withFileTypes: true })
    return entries
      .filter((e) => !IGNORED.has(e.name) && !e.name.startsWith('.git'))
      .map((e) => ({
        name: e.name,
        path: dirPath ? `${dirPath}/${e.name}` : e.name,
        type: e.isDirectory() ? 'directory' as const : 'file' as const
      }))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
        return a.name.localeCompare(b.name)
      })
  })

  ipcMain.handle('fs:readFile', (_event, rootPath: string, filePath: string): string => {
    const abs = assertWithinRoot(rootPath, filePath)
    return fs.readFileSync(abs, 'utf-8')
  })

  ipcMain.handle('fs:writeFile', (_event, rootPath: string, filePath: string, content: string): void => {
    const abs = assertWithinRoot(rootPath, filePath)
    fs.writeFileSync(abs, content, 'utf-8')
  })

  ipcMain.handle('fs:createFile', (_event, rootPath: string, filePath: string): void => {
    const abs = assertWithinRoot(rootPath, filePath)
    if (fs.existsSync(abs)) throw new Error('File already exists')
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, '', 'utf-8')
  })

  ipcMain.handle('fs:createDir', (_event, rootPath: string, dirPath: string): void => {
    const abs = assertWithinRoot(rootPath, dirPath)
    fs.mkdirSync(abs, { recursive: true })
  })

  ipcMain.handle('fs:rename', (_event, rootPath: string, oldPath: string, newPath: string): void => {
    const absOld = assertWithinRoot(rootPath, oldPath)
    const absNew = assertWithinRoot(rootPath, newPath)
    fs.renameSync(absOld, absNew)
  })

  ipcMain.handle('fs:delete', (_event, rootPath: string, targetPath: string): void => {
    const abs = assertWithinRoot(rootPath, targetPath)
    fs.rmSync(abs, { recursive: true })
  })
}
