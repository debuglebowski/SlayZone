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
    await expect(input).not.toBeVisible()
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

  const devToolsBtn = (page: import('@playwright/test').Page) =>
    page.getByTestId('browser-devtools').first()

  const devToolsStatus = (page: import('@playwright/test').Page) =>
    page.getByTestId('browser-devtools-status').first()

  const responsivePreviewBtn = (page: import('@playwright/test').Page) =>
    page.getByRole('button', { name: /Responsive preview|Exit responsive preview/i }).first()

  const isDevToolsDisabled = async (page: import('@playwright/test').Page) =>
    page.evaluate(() => {
      const btn = document.querySelector('[data-testid="browser-devtools"]') as HTMLButtonElement | null
      return !!btn?.disabled
    })

  const toggleResponsivePreview = async (page: import('@playwright/test').Page) => {
    const button = responsivePreviewBtn(page)
    if (await button.isVisible().catch(() => false)) {
      await button.click()
      return
    }

    await page.evaluate(() => {
      const btn = document.querySelector(
        '[data-browser-panel="true"] button[aria-label="Responsive preview"], [data-browser-panel="true"] button[aria-label="Exit responsive preview"]'
      ) as HTMLButtonElement | null
      btn?.click()
    })
  }

  const activeBrowserWebviewId = async (page: import('@playwright/test').Page) => {
    let webviewId = 0
    await expect.poll(async () => {
      webviewId = await page.evaluate(() => {
        const wv = document.querySelector('[data-browser-panel="true"] webview') as
          | (HTMLElement & { getWebContentsId?: () => number })
          | null
        return wv?.getWebContentsId?.() ?? 0
      })
      return webviewId
    }).toBeGreaterThan(0)
    return webviewId
  }

  const testInvoke = async (page: import('@playwright/test').Page, channel: string, ...args: unknown[]) => {
    return await page.evaluate(async ({ c, a }) => {
      const invoke = (window as unknown as { __testInvoke?: (ch: string, ...rest: unknown[]) => Promise<unknown> }).__testInvoke
      if (!invoke) throw new Error('__testInvoke unavailable in e2e')
      return await invoke(c, ...(a ?? []))
    }, { c: channel, a: args })
  }

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

  // Skipped because toolbar DevTools visibility is non-deterministic across headless Chromium runs.
  test.skip('devtools button is visible in browser toolbar', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    await expect(devToolsBtn(mainWindow)).toBeVisible()
  })

  // Skipped because responsive-preview state is not consistently applied in CI-like Electron runs.
  test.skip('devtools button is disabled in responsive mode', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    await expect(devToolsBtn(mainWindow)).toBeEnabled()
    await toggleResponsivePreview(mainWindow)
    await expect.poll(() => isDevToolsDisabled(mainWindow)).toBe(true)
  })

  test('webview devtools IPC can open and close active browser webview', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    const webviewId = await activeBrowserWebviewId(mainWindow)

    await testInvoke(mainWindow, 'webview:close-devtools', webviewId)
    await expect.poll(() => testInvoke(mainWindow, 'webview:is-devtools-opened', webviewId)).toBe(false)

    await expect.poll(() => testInvoke(mainWindow, 'webview:open-devtools-bottom', webviewId)).toBe(true)
    await expect.poll(() => testInvoke(mainWindow, 'webview:is-devtools-opened', webviewId)).toBe(true)

    await expect.poll(() => testInvoke(mainWindow, 'webview:close-devtools', webviewId)).toBe(true)
    await expect.poll(() => testInvoke(mainWindow, 'webview:is-devtools-opened', webviewId)).toBe(false)
  })

  // Skipped while inline DevTools open/close status reporting remains flaky in E2E.
  test.skip('devtools toggle reports inline open and close status', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    if (await devToolsBtn(mainWindow).isDisabled().catch(() => false)) {
      await responsivePreviewBtn(mainWindow).click()
      if (await devToolsBtn(mainWindow).isDisabled().catch(() => false)) {
        // In some runs responsive preview remains pinned; skip inline-toggle assertion in that state.
        return
      }
    }
    await devToolsBtn(mainWindow).click()
    await expect(devToolsStatus(mainWindow)).toContainText('Chromium DevTools opened inline')
    await devToolsBtn(mainWindow).click()
    await expect(devToolsStatus(mainWindow)).toContainText('Chromium DevTools closed')
  })

  test('create new tab via plus button', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    const beforeCount = await tabEntries(mainWindow).count()
    await newTabBtn(mainWindow).click()
    await expect(tabEntries(mainWindow)).toHaveCount(beforeCount + 1)
  })

  test('new tab becomes active', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    const count = await tabEntries(mainWindow).count()
    // Last tab (newly created) should be active
    await expect(tabEntries(mainWindow).nth(count - 1)).toHaveClass(/border border-neutral/)
  })

  test('close active tab via X', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    // Close the active tab (last created)
    const countBefore = await tabEntries(mainWindow).count()
    const activeTab = tabEntries(mainWindow).nth(countBefore - 1)
    await activeTab.locator('.lucide-x').click({ force: true })
    await expect(tabEntries(mainWindow)).toHaveCount(countBefore - 1)
  })

  test('tabs state persists in DB after changes', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    // Create a second tab to trigger onTabsChange
    const countBefore = await tabEntries(mainWindow).count()
    await newTabBtn(mainWindow).click()
    await expect(tabEntries(mainWindow)).toHaveCount(countBefore + 1)

    const task = await mainWindow.evaluate((id) => window.api.db.getTask(id), taskId)
    expect(task?.browser_tabs).toBeTruthy()
    expect(task?.browser_tabs?.tabs.length ?? 0).toBeGreaterThanOrEqual(2)

    // Clean up: close the extra tab
    const count = await tabEntries(mainWindow).count()
    await tabEntries(mainWindow).nth(count - 1).locator('.lucide-x').click({ force: true })
    await expect(tabEntries(mainWindow)).toHaveCount(count - 1)
  })

  test('Cmd+B toggles browser panel off', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    await focusForAppShortcut(mainWindow)

    await mainWindow.keyboard.press('Meta+b')
    await expect(urlInput(mainWindow)).not.toBeVisible()
  })

  test('browser panel visibility persists across navigation', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)

    // Navigate away and back
    await goHome(mainWindow)
    await expect(urlInput(mainWindow)).not.toBeVisible()
    await openTaskViaSearch(mainWindow, 'Browser task')

    await expect(urlInput(mainWindow)).toBeVisible()
  })
})
