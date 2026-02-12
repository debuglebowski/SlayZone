import { test, expect, seed } from './fixtures/electron'
import { TEST_PROJECT_PATH } from './fixtures/electron'
import {
  getMainSessionId,
  openTaskTerminal,
  runCommand,
  waitForBufferContains,
  waitForPtySession,
  waitForPtyState,
} from './fixtures/terminal'

test.describe('Dev server URL detection', () => {
  let projectAbbrev: string
  let taskId: string
  let sessionId: string

  const urlInput = (page: import('@playwright/test').Page) =>
    page.locator('input[placeholder="Enter URL..."]:visible').first()

  const toast = (page: import('@playwright/test').Page) =>
    page.getByText('Dev server at').first()

  const focusForAppShortcut = async (page: import('@playwright/test').Page) => {
    await page.keyboard.press('Escape').catch(() => {})
    const sidebar = page.locator('[data-slot="sidebar"]').first()
    if (await sidebar.isVisible().catch(() => false)) {
      await sidebar.click({ position: { x: 12, y: 12 } }).catch(() => {})
    } else {
      await page.locator('#root').click({ position: { x: 12, y: 12 } }).catch(() => {})
    }
  }

  test.beforeAll(async ({ mainWindow }) => {
    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'Dev Detect', color: '#06b6d4', path: TEST_PROJECT_PATH })
    projectAbbrev = p.name.slice(0, 2).toUpperCase()

    const t = await s.createTask({ projectId: p.id, title: 'Dev server task', status: 'todo' })
    taskId = t.id
    sessionId = getMainSessionId(taskId)

    await mainWindow.evaluate((id) => window.api.db.updateTask({ id, terminalMode: 'terminal' }), taskId)
    await s.refreshData()

    await openTaskTerminal(mainWindow, { projectAbbrev, taskTitle: 'Dev server task' })
    await waitForPtySession(mainWindow, sessionId)
    await waitForPtyState(mainWindow, sessionId, 'attention')
  })

  test('toast appears when localhost URL printed in terminal', async ({ mainWindow }) => {
    await runCommand(mainWindow, sessionId, 'echo http://localhost:3456')
    await waitForBufferContains(mainWindow, sessionId, 'http://localhost:3456')

    await expect(toast(mainWindow)).toBeVisible({ timeout: 5_000 })
    await expect(mainWindow.getByText('http://localhost:3456').first()).toBeVisible()
  })

  test('clicking Open opens browser panel with detected URL', async ({ mainWindow }) => {
    await expect(toast(mainWindow)).toBeVisible({ timeout: 5_000 })

    const openBtn = toast(mainWindow).locator('..').getByText('Open preview').first()
    await openBtn.click()

    // Browser panel should be visible
    await expect(urlInput(mainWindow)).toBeVisible({ timeout: 5_000 })

    // Toast should be dismissed
    await expect(toast(mainWindow)).not.toBeVisible({ timeout: 3_000 })

    // Verify browser tab has the URL
    const task = await mainWindow.evaluate((id) => window.api.db.getTask(id), taskId)
    const tabs = task?.browser_tabs?.tabs ?? []
    expect(tabs.some((t: { url: string }) => t.url === 'http://localhost:3456')).toBe(true)
  })

  test('dismiss hides toast', async ({ mainWindow }) => {
    // Close browser panel first (opened by previous test) so toast can appear
    await focusForAppShortcut(mainWindow)
    await mainWindow.keyboard.press('Meta+b')
    await expect(urlInput(mainWindow)).not.toBeVisible({ timeout: 3_000 })

    // Use a new URL (pty-manager dedup means previously-seen URLs won't re-fire)
    await runCommand(mainWindow, sessionId, 'echo http://localhost:7777')
    await waitForBufferContains(mainWindow, sessionId, 'http://localhost:7777')

    await expect(toast(mainWindow)).toBeVisible({ timeout: 5_000 })

    // Click X to dismiss
    const dismissBtn = toast(mainWindow).locator('..').locator('.lucide-x').first()
    await dismissBtn.click()

    await expect(toast(mainWindow)).not.toBeVisible({ timeout: 3_000 })
  })

  test('same URL does not re-trigger toast', async ({ mainWindow }) => {
    // Echo same URL again — pty-manager dedup prevents re-emission
    await runCommand(mainWindow, sessionId, 'echo http://localhost:7777')
    await waitForBufferContains(mainWindow, sessionId, 'http://localhost:7777')

    // Wait to confirm no toast appears
    await mainWindow.waitForTimeout(1_500)
    await expect(toast(mainWindow)).not.toBeVisible()
  })
})
