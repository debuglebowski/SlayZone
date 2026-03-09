import { webContents } from 'electron'

// taskId → webContentsId (only set when tab 0 is active)
const registry = new Map<string, number>()

export function registerBrowserPanel(taskId: string, webContentsId: number): void {
  registry.set(taskId, webContentsId)
  const wc = webContents.fromId(webContentsId)
  if (wc) {
    wc.once('destroyed', () => {
      if (registry.get(taskId) === webContentsId) {
        registry.delete(taskId)
      }
    })
  }
}

export function unregisterBrowserPanel(taskId: string): void {
  registry.delete(taskId)
}

export function clearBrowserRegistry(): void {
  registry.clear()
}

export function getBrowserWebContents(taskId: string): Electron.WebContents | null {
  const id = registry.get(taskId)
  if (id == null) return null
  const wc = webContents.fromId(id)
  if (!wc || wc.isDestroyed()) {
    registry.delete(taskId)
    return null
  }
  return wc
}
