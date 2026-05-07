import { BrowserWindow, app, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { EventEmitter } from 'node:events'
import { redirectSessionWindow, getBufferSince } from '@slayzone/terminal/electron'

export const taskWindowsEvents = new EventEmitter() as EventEmitter & {
  on(event: 'list-changed', listener: (taskIds: string[]) => void): EventEmitter
  on(event: 'primary-active-changed', listener: (taskId: string | null) => void): EventEmitter
  on(event: 'ownership-changed', listener: (payload: { taskId: string; ownership: Array<{ panelId: string; ownerWindowId: number }> }) => void): EventEmitter
  on(event: 'panels-released-on-close', listener: (payload: { closedWindowId: number; released: OwnershipKey[] }) => void): EventEmitter
  on(event: 'panels-close-request', listener: (targetWindowId: number, payload: { taskId: string; panelId: string }) => void): EventEmitter
  off(event: string, listener: (...args: unknown[]) => void): EventEmitter
}

interface OwnershipKey {
  taskId: string
  panelId: string
}

function ownershipKey(taskId: string, panelId: string): string {
  return `${taskId}::${panelId}`
}

const ownership = new Map<string, number>() // key → owner webContents.id
const taskWindows = new Map<number, { window: BrowserWindow; taskId: string }>() // webContents.id → entry
let primaryWindow: BrowserWindow | null = null

export function attachTaskWindows(win: BrowserWindow): void {
  primaryWindow = win
}

function ownershipSnapshotForTask(taskId: string): Array<{ panelId: string; ownerWindowId: number }> {
  const out: Array<{ panelId: string; ownerWindowId: number }> = []
  for (const [key, ownerWindowId] of ownership.entries()) {
    const [tid, panelId] = key.split('::')
    if (tid === taskId) out.push({ panelId, ownerWindowId })
  }
  return out
}

function broadcastOwnership(taskId: string): void {
  taskWindowsEvents.emit('ownership-changed', { taskId, ownership: ownershipSnapshotForTask(taskId) })
}

function openTaskIds(): string[] {
  const out: string[] = []
  for (const entry of taskWindows.values()) {
    if (!entry.window.isDestroyed()) out.push(entry.taskId)
  }
  return out
}

function broadcastTaskWindowList(): void {
  taskWindowsEvents.emit('list-changed', openTaskIds())
}

function createSecondaryTaskWindow(taskId: string): BrowserWindow {
  const cursor = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursor)
  const w = 1100
  const h = 760
  const win = new BrowserWindow({
    width: w,
    height: h,
    x: display.workArea.x + Math.round((display.workArea.width - w) / 2),
    y: display.workArea.y + Math.round((display.workArea.height - h) / 2),
    show: true,
    title: 'SlayZone',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 10, y: 12 },
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true
    }
  })
  const params = new URLSearchParams({ taskWindow: taskId })
  const url = is.dev && process.env['ELECTRON_RENDERER_URL']
    ? `${process.env['ELECTRON_RENDERER_URL']}?${params.toString()}`
    : `file://${join(__dirname, '../renderer/index.html')}?${params.toString()}`
  win.loadURL(url)
  const wcId = win.webContents.id
  taskWindows.set(wcId, { window: win, taskId })

  win.on('closed', () => {
    const closedWcId = wcId
    taskWindows.delete(closedWcId)
    broadcastTaskWindowList()

    // Release ownership entries held by this window. Group by taskId for broadcasts.
    const releasedTasks = new Set<string>()
    const releasedKeys: OwnershipKey[] = []
    for (const [key, ownerWindowId] of ownership.entries()) {
      if (ownerWindowId === closedWcId) {
        ownership.delete(key)
        const [taskId, panelId] = key.split('::')
        releasedKeys.push({ taskId, panelId })
        releasedTasks.add(taskId)
      }
    }
    for (const taskId of releasedTasks) broadcastOwnership(taskId)
    if (releasedKeys.length > 0) {
      taskWindowsEvents.emit('panels-released-on-close', { closedWindowId: closedWcId, released: releasedKeys })
    }
  })

  return win
}

// Primary's active task tracker. Broadcast to all secondaries so "Follow current tab"
// mode in secondary can swap to whatever task primary is showing.
let primaryActiveTaskId: string | null = null

export const taskWindowsOps = {
  open: (taskId: string) => {
    if (!taskId) return { ok: false }
    for (const entry of taskWindows.values()) {
      if (entry.taskId === taskId && !entry.window.isDestroyed()) {
        entry.window.focus()
        return { ok: true, focused: true }
      }
    }
    createSecondaryTaskWindow(taskId)
    broadcastTaskWindowList()
    return { ok: true }
  },
  close: (taskId: string) => {
    let closed = 0
    for (const entry of Array.from(taskWindows.values())) {
      if (entry.taskId === taskId && !entry.window.isDestroyed()) {
        entry.window.close()
        closed++
      }
    }
    return { ok: true, closed }
  },
  list: () => openTaskIds(),
  setPrimaryActive: (taskId: string | null, callerWindowId: number | null) => {
    // Only the primary window may set; secondaries silently ignore.
    if (!primaryWindow || callerWindowId !== primaryWindow.webContents.id) return { ok: false }
    primaryActiveTaskId = taskId
    taskWindowsEvents.emit('primary-active-changed', taskId)
    return { ok: true }
  },
  getPrimaryActive: () => primaryActiveTaskId,

  claimPanel: (taskId: string, panelId: string, ownerWindowId: number) => {
    const key = ownershipKey(taskId, panelId)
    const prev = ownership.get(key)
    if (prev === ownerWindowId) return { ok: true, unchanged: true }
    ownership.set(key, ownerWindowId)
    broadcastOwnership(taskId)
    return { ok: true }
  },
  releasePanel: (taskId: string, panelId: string, callerWindowId: number) => {
    const key = ownershipKey(taskId, panelId)
    const prev = ownership.get(key)
    if (prev === undefined) return { ok: true, unchanged: true }
    if (prev !== callerWindowId) return { ok: false, reason: 'not-owner' }
    ownership.delete(key)
    broadcastOwnership(taskId)
    return { ok: true }
  },
  releaseAllForTask: (taskId: string, callerWindowId: number) => {
    const prefix = `${taskId}::`
    let released = 0
    for (const [key, ownerId] of Array.from(ownership.entries())) {
      if (ownerId === callerWindowId && key.startsWith(prefix)) {
        ownership.delete(key)
        released++
      }
    }
    if (released > 0) broadcastOwnership(taskId)
    return { ok: true, released }
  },
  getOwnership: (taskId: string) => ownershipSnapshotForTask(taskId),
  getWindowId: (callerWindowId: number) => callerWindowId,
  claimAndCloseOther: (taskId: string, panelId: string, ownerWindowId: number) => {
    const key = ownershipKey(taskId, panelId)
    const prevOwnerId = ownership.get(key)
    ownership.set(key, ownerWindowId)
    broadcastOwnership(taskId)
    if (prevOwnerId !== undefined && prevOwnerId !== ownerWindowId) {
      taskWindowsEvents.emit('panels-close-request', prevOwnerId, { taskId, panelId })
    }
    return { ok: true }
  },
  claimSession: (sessionId: string, callerWindowId: number) => {
    // Find the BrowserWindow with the matching webContents.id
    let win: BrowserWindow | null = null
    if (primaryWindow && !primaryWindow.isDestroyed() && primaryWindow.webContents.id === callerWindowId) {
      win = primaryWindow
    } else {
      for (const entry of taskWindows.values()) {
        if (!entry.window.isDestroyed() && entry.window.webContents.id === callerWindowId) {
          win = entry.window
          break
        }
      }
    }
    if (!win) return { ok: false }
    const ok = redirectSessionWindow(sessionId, win)
    if (!ok) return { ok: false }
    const result = getBufferSince(sessionId, -1)
    if (result) {
      for (const chunk of result.chunks) {
        try { win.webContents.send('pty:data', sessionId, chunk.data, chunk.seq) } catch { /* ignore */ }
      }
    }
    return { ok: true }
  },
}

export function setupTaskWindows(): void {
  app.on('before-quit', () => {
    for (const entry of taskWindows.values()) {
      if (!entry.window.isDestroyed()) entry.window.destroy()
    }
    taskWindows.clear()
    ownership.clear()
  })
}

export function getTaskWindowsForTaskId(taskId: string): BrowserWindow[] {
  const out: BrowserWindow[] = []
  for (const entry of taskWindows.values()) {
    if (entry.taskId === taskId && !entry.window.isDestroyed()) out.push(entry.window)
  }
  return out
}
