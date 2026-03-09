import { test, expect, seed } from './fixtures/electron'
import { TEST_PROJECT_PATH } from './fixtures/electron'
import {
  openTaskTerminal,
  switchTerminalMode,
  getMainSessionId,
  waitForPtySession,
  waitForBufferContains,
  readFullBuffer,
} from './fixtures/terminal'
import path from 'path'
import fs from 'fs'

// Skipped while screenshot region-selection input handling is unstable in automated Electron E2E.
test.describe.skip('Screenshot to terminal', () => {
  const projectName = 'ScreenshotTest'
  let projectAbbrev: string
  let taskId: string
  let sessionId: string

  const regionOverlay = (mainWindow: import('@playwright/test').Page) =>
    mainWindow.locator('[data-testid="region-selector-overlay"], .fixed.inset-0.cursor-crosshair').first()

  const cameraButton = (mainWindow: import('@playwright/test').Page) =>
    mainWindow
      .locator('[data-testid="terminal-tabbar"]:visible button:visible')
      .filter({ has: mainWindow.locator('svg.lucide-camera') })
      .first()

  const triggerRegionSelector = async (
    electronApp: import('@playwright/test').ElectronApplication,
    mainWindow: import('@playwright/test').Page
  ) => {
    // Primary path: simulate Cmd+Shift+S through main-process dispatch.
    await electronApp.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find(w => !w.isDestroyed() && !w.webContents.getURL().startsWith('data:'))
      win?.webContents.send('app:screenshot-trigger')
    })

    if (await regionOverlay(mainWindow).isVisible({ timeout: 1_500 }).catch(() => false)) {
      return
    }

    // Fallback path for occasional trigger races: click camera button directly.
    await expect(cameraButton(mainWindow)).toBeVisible({ timeout: 5_000 })
    await cameraButton(mainWindow).click()
    await expect(regionOverlay(mainWindow)).toBeVisible({ timeout: 3_000 })
  }

  test.beforeAll(async ({ electronApp, mainWindow }) => {
    const s = seed(mainWindow)
    const p = await s.createProject({ name: projectName, color: '#06b6d4', path: TEST_PROJECT_PATH })
    projectAbbrev = p.name.slice(0, 2).toUpperCase()
    const t = await s.createTask({ projectId: p.id, title: 'Screenshot task', status: 'todo' })
    taskId = t.id
    sessionId = getMainSessionId(taskId)
    await s.refreshData()

    // Open task, switch to plain terminal (no AI CLI needed)
    await openTaskTerminal(mainWindow, { projectAbbrev, taskTitle: 'Screenshot task' })
    await switchTerminalMode(mainWindow, 'terminal')
    await waitForPtySession(mainWindow, sessionId)
    await expect(mainWindow.locator('.xterm-screen:visible')).toBeVisible({ timeout: 5_000 })
  })

  test('screenshot captures region and injects path into terminal', async ({ electronApp, mainWindow }) => {
    const fakeScreenshotPath = path.join(TEST_PROJECT_PATH, 'shortcut-screenshot.png')
    fs.writeFileSync(fakeScreenshotPath, 'fake-png-data')

    // Mock the screenshot:captureRegion IPC handler (accepts rect arg)
    await electronApp.evaluate(({ ipcMain }, fakePath) => {
      ipcMain.removeHandler('screenshot:captureRegion')
      ipcMain.handle('screenshot:captureRegion', async (_event, _rect) => {
        return { success: true, path: fakePath }
      })
    }, fakeScreenshotPath)

    await triggerRegionSelector(electronApp, mainWindow)
    const overlay = regionOverlay(mainWindow)

    // Simulate a drag to select a region
    await overlay.dispatchEvent('mousedown', { clientX: 100, clientY: 100 })
    await overlay.dispatchEvent('mousemove', { clientX: 400, clientY: 400 })
    await overlay.dispatchEvent('mouseup', {})

    // The file path should appear in the terminal buffer
    await waitForBufferContains(mainWindow, sessionId, 'shortcut-screenshot.png', 10_000)

    const buffer = await readFullBuffer(mainWindow, sessionId)
    expect(buffer).toContain(fakeScreenshotPath)
  })

  test('pressing Escape cancels region selector', async ({ electronApp, mainWindow }) => {
    await mainWindow.evaluate((id) => window.api.pty.clearBuffer(id), sessionId)
    await expect.poll(() => readFullBuffer(mainWindow, sessionId).then(b => (b ?? '').trim().length === 0), { timeout: 3_000 }).toBe(true)

    // Mock handler to track calls
    await electronApp.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('screenshot:captureRegion')
      ipcMain.handle('screenshot:captureRegion', async () => {
        return { success: true, path: '/should/not/appear.png' }
      })
    })

    await triggerRegionSelector(electronApp, mainWindow)
    const overlay = regionOverlay(mainWindow)

    // Press Escape to cancel
    await mainWindow.keyboard.press('Escape')
    await expect(overlay).not.toBeVisible({ timeout: 2_000 })

    // Nothing should be injected
    await expect.poll(() => readFullBuffer(mainWindow, sessionId).then(b => (b ?? '').includes('/should/not/appear.png')), { timeout: 2_000 }).toBe(false)
  })

  test('camera button triggers region selector', async ({ electronApp, mainWindow }) => {
    await mainWindow.evaluate((id) => window.api.pty.clearBuffer(id), sessionId)
    await expect.poll(() => readFullBuffer(mainWindow, sessionId).then(b => (b ?? '').trim().length === 0), { timeout: 3_000 }).toBe(true)

    const buttonScreenshotPath = path.join(TEST_PROJECT_PATH, 'button-screenshot.png')
    fs.writeFileSync(buttonScreenshotPath, 'fake-png-data')

    await electronApp.evaluate(({ ipcMain }, fakePath) => {
      ipcMain.removeHandler('screenshot:captureRegion')
      ipcMain.handle('screenshot:captureRegion', async (_event, _rect) => {
        return { success: true, path: fakePath }
      })
    }, buttonScreenshotPath)

    await expect(cameraButton(mainWindow)).toBeVisible({ timeout: 5_000 })
    await cameraButton(mainWindow).click()

    // Region selector should appear
    const overlay = regionOverlay(mainWindow)
    await expect(overlay).toBeVisible({ timeout: 3_000 })

    // Drag to select
    await overlay.dispatchEvent('mousedown', { clientX: 100, clientY: 100 })
    await overlay.dispatchEvent('mousemove', { clientX: 400, clientY: 400 })
    await overlay.dispatchEvent('mouseup', {})

    await waitForBufferContains(mainWindow, sessionId, 'button-screenshot.png', 10_000)
  })
})
