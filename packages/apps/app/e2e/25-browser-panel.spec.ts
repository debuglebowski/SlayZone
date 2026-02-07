import { test, expect, seed, goHome, clickProject } from './fixtures/electron'
import { TEST_PROJECT_PATH } from './fixtures/electron'

test.describe('Browser panel', () => {
  let projectAbbrev: string
  let taskId: string

  test.beforeAll(async ({ mainWindow }) => {
    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'Browser Test', color: '#0ea5e9', path: TEST_PROJECT_PATH })
    projectAbbrev = p.name.slice(0, 2).toUpperCase()
    const t = await s.createTask({ projectId: p.id, title: 'Browser task', status: 'todo' })
    taskId = t.id
    await s.refreshData()

    await goHome(mainWindow)
    await clickProject(mainWindow, projectAbbrev)
    await mainWindow.waitForTimeout(500)

    // Open task detail
    await mainWindow.getByText('Browser task').first().click()
    await mainWindow.waitForTimeout(500)
  })

  /** URL input field */
  const urlInput = (page: import('@playwright/test').Page) =>
    page.locator('input[placeholder="Enter URL..."]')

  /** Browser tab bar — the h-10 bar containing tab buttons */
  const tabBar = (page: import('@playwright/test').Page) =>
    page.locator('.h-10.overflow-x-auto')

  /** Tab entries in the tab bar */
  const tabEntries = (page: import('@playwright/test').Page) =>
    tabBar(page).locator('[role="button"]')

  /** Plus button in the tab bar */
  const newTabBtn = (page: import('@playwright/test').Page) =>
    tabBar(page).locator('button:has(.lucide-plus)')

  test('browser panel hidden by default', async ({ mainWindow }) => {
    await expect(urlInput(mainWindow)).not.toBeVisible()
  })

  test('Cmd+B toggles browser panel on', async ({ mainWindow }) => {
    await mainWindow.keyboard.press('Meta+b')
    await mainWindow.waitForTimeout(300)
    await expect(urlInput(mainWindow)).toBeVisible()
  })

  test('initial tab shows New Tab', async ({ mainWindow }) => {
    await expect(tabEntries(mainWindow).first()).toContainText(/New Tab|about:blank/)
    await expect(tabEntries(mainWindow)).toHaveCount(1)
  })

  test('type URL in address bar', async ({ mainWindow }) => {
    const input = urlInput(mainWindow)
    await input.click()
    await input.fill('https://example.com')
    await expect(input).toHaveValue('https://example.com')
  })

  test('create new tab via plus button', async ({ mainWindow }) => {
    await newTabBtn(mainWindow).click()
    await mainWindow.waitForTimeout(500)
    await expect(tabEntries(mainWindow)).toHaveCount(2)
  })

  test('new tab becomes active', async ({ mainWindow }) => {
    // Second tab (newly created) should be active
    await expect(tabEntries(mainWindow).nth(1)).toHaveClass(/border-b-primary/)
  })

  test('close active tab via X', async ({ mainWindow }) => {
    // Close the active (second) tab's X button
    const activeTab = tabEntries(mainWindow).nth(1)
    await activeTab.locator('.lucide-x').click({ force: true })
    await mainWindow.waitForTimeout(500)

    // Should be back to 1 tab
    await expect(tabEntries(mainWindow)).toHaveCount(1)
  })

  test('tabs state persists in DB after changes', async ({ mainWindow }) => {
    // Create a second tab to trigger onTabsChange
    await newTabBtn(mainWindow).click()
    await mainWindow.waitForTimeout(500)

    const task = await mainWindow.evaluate((id) => window.api.db.getTask(id), taskId)
    expect(task?.browser_tabs).toBeTruthy()
    expect(task?.browser_tabs?.tabs.length).toBe(2)

    // Clean up: close the extra tab
    await tabEntries(mainWindow).nth(1).locator('.lucide-x').click({ force: true })
    await mainWindow.waitForTimeout(500)
  })

  test('Cmd+B toggles browser panel off', async ({ mainWindow }) => {
    // Focus the URL input to ensure keystroke reaches the app window (not webview)
    await urlInput(mainWindow).focus()
    await mainWindow.waitForTimeout(100)

    await mainWindow.keyboard.press('Meta+b')
    await mainWindow.waitForTimeout(300)
    await expect(urlInput(mainWindow)).not.toBeVisible()
  })

  test('browser panel visibility persists across navigation', async ({ mainWindow }) => {
    // Turn panel back on
    await mainWindow.keyboard.press('Meta+b')
    await mainWindow.waitForTimeout(300)
    await expect(urlInput(mainWindow)).toBeVisible()

    // Navigate away and back
    await goHome(mainWindow)
    await mainWindow.waitForTimeout(300)
    await clickProject(mainWindow, projectAbbrev)
    await mainWindow.waitForTimeout(300)
    await mainWindow.getByText('Browser task').first().click()
    await mainWindow.waitForTimeout(500)

    await expect(urlInput(mainWindow)).toBeVisible()
  })
})
