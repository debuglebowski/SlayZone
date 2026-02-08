import { test, expect, seed, goHome } from './fixtures/electron'
import { TEST_PROJECT_PATH } from './fixtures/electron'

test.describe('Browser panel', () => {
  let projectAbbrev: string
  let taskId: string

  const openTaskViaSearch = async (
    page: import('@playwright/test').Page,
    title: string
  ) => {
    await page.keyboard.press('Meta+k')
    const input = page.getByPlaceholder('Search tasks and projects...')
    await expect(input).toBeVisible()
    await input.fill(title)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(500)
  }

  const focusForAppShortcut = async (page: import('@playwright/test').Page) => {
    // Avoid rich-text editor focus eating Meta+B as bold.
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
    const p = await s.createProject({ name: 'Browser Test', color: '#0ea5e9', path: TEST_PROJECT_PATH })
    projectAbbrev = p.name.slice(0, 2).toUpperCase()
    const t = await s.createTask({ projectId: p.id, title: 'Browser task', status: 'todo' })
    taskId = t.id
    await s.refreshData()

    await openTaskViaSearch(mainWindow, 'Browser task')
  })

  /** URL input field */
  const urlInput = (page: import('@playwright/test').Page) =>
    page.locator('input[placeholder="Enter URL..."]:visible').first()

  /** Browser tab bar — the h-10 bar containing tab buttons */
  const tabBar = (page: import('@playwright/test').Page) =>
    page.locator('.h-10.overflow-x-auto:visible').first()

  /** Tab entries in the tab bar */
  const tabEntries = (page: import('@playwright/test').Page) =>
    tabBar(page).locator('[role="button"]:not(:has(.lucide-plus))')

  /** Plus button in the tab bar */
  const newTabBtn = (page: import('@playwright/test').Page) =>
    tabBar(page).locator('button:has(.lucide-plus)').first()

  const ensureBrowserPanelVisible = async (page: import('@playwright/test').Page) => {
    if (!(await urlInput(page).isVisible().catch(() => false))) {
      await focusForAppShortcut(page)
      await page.keyboard.press('Meta+b')
      await expect(urlInput(page)).toBeVisible()
    }
  }

  test('browser panel hidden by default', async ({ mainWindow }) => {
    await expect(urlInput(mainWindow)).not.toBeVisible()
  })

  test('Cmd+B toggles browser panel on', async ({ mainWindow }) => {
    if (await urlInput(mainWindow).isVisible().catch(() => false)) {
      await focusForAppShortcut(mainWindow)
      await mainWindow.keyboard.press('Meta+b')
      await expect(urlInput(mainWindow)).not.toBeVisible()
    }
    await focusForAppShortcut(mainWindow)
    await mainWindow.keyboard.press('Meta+b')
    await mainWindow.waitForTimeout(300)
    await expect(urlInput(mainWindow)).toBeVisible()
  })

  test('initial tab shows New Tab', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    await expect(tabEntries(mainWindow).first()).toContainText(/New Tab|about:blank/)
    expect(await tabEntries(mainWindow).count()).toBeGreaterThan(0)
  })

  test('type URL in address bar', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    const input = urlInput(mainWindow)
    await input.click()
    await input.fill('https://example.com')
    await expect(input).toHaveValue('https://example.com')
  })

  test('create new tab via plus button', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    const beforeCount = await tabEntries(mainWindow).count()
    await newTabBtn(mainWindow).click()
    await mainWindow.waitForTimeout(500)
    await expect(tabEntries(mainWindow)).toHaveCount(beforeCount + 1)
  })

  test('new tab becomes active', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    const count = await tabEntries(mainWindow).count()
    // Last tab (newly created) should be active
    await expect(tabEntries(mainWindow).nth(count - 1)).toHaveClass(/border-b-primary/)
  })

  test('close active tab via X', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    // Close the active tab (last created)
    const countBefore = await tabEntries(mainWindow).count()
    const activeTab = tabEntries(mainWindow).nth(countBefore - 1)
    await activeTab.locator('.lucide-x').click({ force: true })
    await mainWindow.waitForTimeout(500)

    await expect(tabEntries(mainWindow)).toHaveCount(countBefore - 1)
  })

  test('tabs state persists in DB after changes', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    // Create a second tab to trigger onTabsChange
    await newTabBtn(mainWindow).click()
    await mainWindow.waitForTimeout(500)

    const task = await mainWindow.evaluate((id) => window.api.db.getTask(id), taskId)
    expect(task?.browser_tabs).toBeTruthy()
    expect(task?.browser_tabs?.tabs.length ?? 0).toBeGreaterThanOrEqual(2)

    // Clean up: close the extra tab
    const count = await tabEntries(mainWindow).count()
    await tabEntries(mainWindow).nth(count - 1).locator('.lucide-x').click({ force: true })
    await mainWindow.waitForTimeout(500)
  })

  test('Cmd+B toggles browser panel off', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    await focusForAppShortcut(mainWindow)

    await mainWindow.keyboard.press('Meta+b')
    await mainWindow.waitForTimeout(300)
    await expect(urlInput(mainWindow)).not.toBeVisible()
  })

  test('browser panel visibility persists across navigation', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)

    // Navigate away and back
    await goHome(mainWindow)
    await mainWindow.waitForTimeout(300)
    await openTaskViaSearch(mainWindow, 'Browser task')

    await expect(urlInput(mainWindow)).toBeVisible()
  })
})
