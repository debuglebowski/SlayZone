import { test, expect, seed } from './fixtures/electron'
import { TEST_PROJECT_PATH } from './fixtures/electron'
import {
  switchTerminalMode,
  getMainSessionId,
  waitForPtySession,
} from './fixtures/terminal'
import { goHome } from './fixtures/electron'

test.describe('DOM picker to terminal', () => {
  const projectName = 'ZZDomPickerTest'
  let taskId: string
  let sessionId: string

  test.beforeAll(async ({ mainWindow }) => {
    const s = seed(mainWindow)
    const p = await s.createProject({ name: projectName, color: '#22c55e', path: TEST_PROJECT_PATH })
    const t = await s.createTask({ projectId: p.id, title: 'DOM picker task', status: 'todo' })
    taskId = t.id
    sessionId = getMainSessionId(taskId)
    await s.refreshData()

    await goHome(mainWindow)
    await mainWindow.keyboard.press('Meta+k')
    const searchInput = mainWindow.getByPlaceholder('Search tasks and projects...')
    await expect(searchInput).toBeVisible({ timeout: 5_000 })
    await searchInput.fill('DOM picker task')
    const dialog = mainWindow.locator('[role="dialog"]:visible').last()
    await dialog.getByText('DOM picker task').first().click()

    await expect(mainWindow.locator('[data-testid="terminal-mode-trigger"]:visible').first()).toBeVisible({ timeout: 5_000 })
    await expect(mainWindow.locator('[data-testid="terminal-tabbar"]:visible').first()).toBeVisible({ timeout: 5_000 })
    await switchTerminalMode(mainWindow, 'terminal')
    await waitForPtySession(mainWindow, sessionId)

    const browserPanel = mainWindow.locator('[data-browser-panel="true"]:visible').first()
    if (await browserPanel.count() === 0) {
      await mainWindow.keyboard.press('Meta+b')
    }
    await expect(mainWindow.locator('[data-browser-panel="true"]:visible').first()).toBeVisible({ timeout: 5_000 })
  })

  test('picker button enables selection mode', async ({ mainWindow }) => {
    const pickButton = mainWindow.locator('[data-testid="browser-pick-element"]:visible').first()
    const activeOverlay = mainWindow.locator('[data-testid="browser-picker-active-overlay"]:visible').first()

    await expect(pickButton).toBeVisible({ timeout: 5_000 })
    if (await activeOverlay.isVisible().catch(() => false)) {
      await pickButton.click()
      await expect(activeOverlay).not.toBeVisible({ timeout: 3_000 })
    }
    await expect(activeOverlay).not.toBeVisible()
    await pickButton.click()

    await expect(activeOverlay).toBeVisible({ timeout: 3_000 })
  })

  test('clicking picker button again toggles selection mode off', async ({ mainWindow }) => {
    const pickButton = mainWindow.locator('[data-testid="browser-pick-element"]:visible').first()
    const activeOverlay = mainWindow.locator('[data-testid="browser-picker-active-overlay"]:visible').first()

    if (!(await activeOverlay.isVisible().catch(() => false))) {
      await pickButton.click()
    }
    await expect(activeOverlay).toBeVisible({ timeout: 3_000 })

    await pickButton.click()
    await expect(activeOverlay).not.toBeVisible({ timeout: 3_000 })
  })

  test('Cmd+Shift+L enables picker without browser focus', async ({ mainWindow }) => {
    const pickButton = mainWindow.locator('[data-testid="browser-pick-element"]:visible').first()
    const activeOverlay = mainWindow.locator('[data-testid="browser-picker-active-overlay"]:visible').first()
    if (await activeOverlay.isVisible().catch(() => false)) {
      await pickButton.click()
      await expect(activeOverlay).not.toBeVisible({ timeout: 3_000 })
    }

    // Focus terminal to prove task-level shortcut works cross-panel.
    await mainWindow.locator('.xterm-screen:visible').first().click()
    await mainWindow.keyboard.press('Meta+Shift+L')

    await expect(activeOverlay).toBeVisible({ timeout: 3_000 })

    // Use button toggle for deterministic shutdown.
    await pickButton.click()
    await expect(activeOverlay).not.toBeVisible({ timeout: 3_000 })
  })

  test('Escape exits picker mode', async ({ mainWindow }) => {
    const pickButton = mainWindow.locator('[data-testid="browser-pick-element"]:visible').first()
    const activeOverlay = mainWindow.locator('[data-testid="browser-picker-active-overlay"]:visible').first()

    if (!(await activeOverlay.isVisible().catch(() => false))) {
      await pickButton.click()
    }
    await expect(activeOverlay).toBeVisible({ timeout: 3_000 })

    await mainWindow.keyboard.press('Escape')
    await expect(activeOverlay).not.toBeVisible({ timeout: 3_000 })
  })
})
