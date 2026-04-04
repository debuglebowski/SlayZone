import { test, expect, seed, resetApp, TEST_PROJECT_PATH } from '../fixtures/electron'
import {
  testInvoke, urlInput, tabEntries, newTabBtn,
  ensureBrowserPanelVisible,
  openTaskViaSearch, getViewsForTask, getActiveViewId,
} from '../fixtures/browser-view'

test.describe('Browser view navigation (WebContentsView)', () => {
  let taskId: string

  test.beforeAll(async ({ mainWindow }) => {
    await resetApp(mainWindow)
    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'Nav Tests', color: '#0ea5e9', path: TEST_PROJECT_PATH })
    const t = await s.createTask({ projectId: p.id, title: 'Navigation task', status: 'todo' })
    taskId = t.id
    await s.refreshData()
    await openTaskViaSearch(mainWindow, 'Navigation task')
  })

  test('navigated page is VISIBLE (native view on screen, not just URL updated)', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    const viewId = await getActiveViewId(mainWindow, taskId)

    const input = urlInput(mainWindow)
    await input.click()
    await input.fill('https://example.com')
    await mainWindow.keyboard.press('Enter')

    // Wait for navigation to complete
    await expect.poll(async () => {
      return (await testInvoke(mainWindow, 'browser:get-url', viewId)) as string
    }, { timeout: 15000 }).toContain('example.com')

    // THE REAL TEST: is the native view actually on screen?
    const nativeBounds = await testInvoke(mainWindow, 'browser:get-actual-native-bounds', viewId) as { x: number; y: number; width: number; height: number }
    expect(nativeBounds.x, 'native view x must not be offscreen (-10000)').toBeGreaterThanOrEqual(0)
    expect(nativeBounds.width, 'native view must have real width, not 1px initial').toBeGreaterThan(50)
    expect(nativeBounds.height, 'native view must have real height, not 1px initial').toBeGreaterThan(50)
  })

  test('navigate via URL bar updates view URL', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    const viewId = await getActiveViewId(mainWindow, taskId)

    const input = urlInput(mainWindow)
    await input.click()
    await input.fill('https://example.com')
    await mainWindow.keyboard.press('Enter')

    await expect.poll(async () => {
      return (await testInvoke(mainWindow, 'browser:get-url', viewId)) as string
    }, { timeout: 10000 }).toContain('example.com')
  })

  test('navigate via IPC changes view URL', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    const viewId = await getActiveViewId(mainWindow, taskId)

    await testInvoke(mainWindow, 'browser:navigate', viewId, 'https://example.org')

    // Verify the view's URL updated in the manager
    await expect.poll(async () => {
      return (await testInvoke(mainWindow, 'browser:get-url', viewId)) as string
    }, { timeout: 15000 }).toContain('example.org')
  })

  test('goBack and goForward work after navigation', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    const viewId = await getActiveViewId(mainWindow, taskId)

    // Navigate to page A
    await testInvoke(mainWindow, 'browser:navigate', viewId, 'https://example.com')
    await expect.poll(async () => {
      return (await testInvoke(mainWindow, 'browser:get-url', viewId)) as string
    }, { timeout: 10000 }).toContain('example.com')

    // Navigate to page B
    await testInvoke(mainWindow, 'browser:navigate', viewId, 'https://example.org')
    await expect.poll(async () => {
      return (await testInvoke(mainWindow, 'browser:get-url', viewId)) as string
    }, { timeout: 10000 }).toContain('example.org')

    // Go back to A
    await testInvoke(mainWindow, 'browser:go-back', viewId)
    await expect.poll(async () => {
      return (await testInvoke(mainWindow, 'browser:get-url', viewId)) as string
    }, { timeout: 10000 }).toContain('example.com')

    // Go forward to B
    await testInvoke(mainWindow, 'browser:go-forward', viewId)
    await expect.poll(async () => {
      return (await testInvoke(mainWindow, 'browser:get-url', viewId)) as string
    }, { timeout: 10000 }).toContain('example.org')
  })

  test('reload reloads current URL', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    const viewId = await getActiveViewId(mainWindow, taskId)

    // Navigate to a known URL
    await testInvoke(mainWindow, 'browser:navigate', viewId, 'https://example.com')
    await expect.poll(async () => {
      return (await testInvoke(mainWindow, 'browser:get-url', viewId)) as string
    }, { timeout: 10000 }).toContain('example.com')

    // Reload — URL should remain the same
    await testInvoke(mainWindow, 'browser:reload', viewId)
    await mainWindow.waitForTimeout(500)
    const url = await testInvoke(mainWindow, 'browser:get-url', viewId) as string
    expect(url).toContain('example.com')
  })

  test('reload with ignoreCache works', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    const viewId = await getActiveViewId(mainWindow, taskId)

    await testInvoke(mainWindow, 'browser:reload', viewId, true)
    await mainWindow.waitForTimeout(500)
    // Should not throw, URL preserved
    const url = await testInvoke(mainWindow, 'browser:get-url', viewId) as string
    expect(typeof url).toBe('string')
  })

  test('stop cancels loading', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    const viewId = await getActiveViewId(mainWindow, taskId)

    // Stop should not throw
    await testInvoke(mainWindow, 'browser:stop', viewId)
  })

  test('tab switch maintains separate views per tab', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    const viewsBefore = await getViewsForTask(mainWindow, taskId)

    // Navigate first tab's view to example.com
    const firstViewId = viewsBefore[0]
    await testInvoke(mainWindow, 'browser:navigate', firstViewId, 'https://example.com')
    await expect.poll(async () => {
      return (await testInvoke(mainWindow, 'browser:get-url', firstViewId)) as string
    }, { timeout: 10000 }).toContain('example.com')

    // Create second tab
    await newTabBtn(mainWindow).click()
    await expect.poll(async () => {
      return (await getViewsForTask(mainWindow, taskId)).length
    }).toBe(viewsBefore.length + 1)

    // Each view maintains its own URL
    const allViews = await getViewsForTask(mainWindow, taskId)
    const firstUrl = await testInvoke(mainWindow, 'browser:get-url', allViews[0]) as string
    expect(firstUrl).toContain('example.com')

    // Second view is a new tab (about:blank or empty)
    const secondUrl = await testInvoke(mainWindow, 'browser:get-url', allViews[allViews.length - 1]) as string
    expect(secondUrl).not.toContain('example.com')

    // Clean up: close second tab
    const count = await tabEntries(mainWindow).count()
    await tabEntries(mainWindow).nth(count - 1).locator('.lucide-x').click({ force: true })
  })

  test('each tab gets its own view', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    const viewsBefore = await getViewsForTask(mainWindow, taskId)

    await newTabBtn(mainWindow).click()
    await expect.poll(async () => {
      return (await getViewsForTask(mainWindow, taskId)).length
    }).toBe(viewsBefore.length + 1)

    // Views are different IDs
    const views = await getViewsForTask(mainWindow, taskId)
    expect(new Set(views).size).toBe(views.length)

    // Clean up
    const count = await tabEntries(mainWindow).count()
    await tabEntries(mainWindow).nth(count - 1).locator('.lucide-x').click({ force: true })
  })

  test('navigate to invalid URL does not crash', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    const viewId = await getActiveViewId(mainWindow, taskId)

    // Navigate to a domain that won't resolve
    await testInvoke(mainWindow, 'browser:navigate', viewId, 'https://this-domain-does-not-exist-12345.invalid')

    // Wait a bit for the attempt — should not crash the view
    await mainWindow.waitForTimeout(2000)

    // View should still be queryable (not destroyed by error)
    const url = await testInvoke(mainWindow, 'browser:get-url', viewId) as string
    expect(typeof url).toBe('string')
  })

  test('executeJs via IPC returns value from page', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    const viewId = await getActiveViewId(mainWindow, taskId)

    // Navigate to a real page first
    await testInvoke(mainWindow, 'browser:navigate', viewId, 'https://example.com')
    await expect.poll(async () => {
      return (await testInvoke(mainWindow, 'browser:get-url', viewId)) as string
    }, { timeout: 15000 }).toContain('example.com')

    // Execute JS and get return value
    const title = await testInvoke(mainWindow, 'browser:execute-js', viewId, 'document.title') as string
    expect(title).toContain('Example')
  })
})
