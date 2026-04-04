import { test, expect, seed, resetApp, TEST_PROJECT_PATH } from '../fixtures/electron'
import {
  testInvoke,
  ensureBrowserPanelVisible,
  ensureBrowserPanelHidden,
  openTaskViaSearch, getActiveViewId,
} from '../fixtures/browser-view'

test.describe('Browser view DevTools (WebContentsView)', () => {
  let taskId: string

  test.beforeAll(async ({ mainWindow }) => {
    await resetApp(mainWindow)
    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'DevTool T', color: '#0ea5e9', path: TEST_PROJECT_PATH })
    const t = await s.createTask({ projectId: p.id, title: 'DevTools task', status: 'todo' })
    taskId = t.id
    await s.refreshData()
    await openTaskViaSearch(mainWindow, 'DevTools task')
  })

  test('devtools starts closed', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    const viewId = await getActiveViewId(mainWindow, taskId)
    const isOpen = await testInvoke(mainWindow, 'browser:is-devtools-open', viewId) as boolean
    expect(isOpen).toBe(false)
  })

  test('open devtools docked bottom', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    const viewId = await getActiveViewId(mainWindow, taskId)

    await testInvoke(mainWindow, 'browser:open-devtools', viewId, 'bottom')
    await expect.poll(() => testInvoke(mainWindow, 'browser:is-devtools-open', viewId)).toBe(true)

    await testInvoke(mainWindow, 'browser:close-devtools', viewId)
  })

  test('open devtools docked right', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    const viewId = await getActiveViewId(mainWindow, taskId)

    await testInvoke(mainWindow, 'browser:open-devtools', viewId, 'right')
    await expect.poll(() => testInvoke(mainWindow, 'browser:is-devtools-open', viewId)).toBe(true)

    await testInvoke(mainWindow, 'browser:close-devtools', viewId)
  })

  test('open devtools undocked', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    const viewId = await getActiveViewId(mainWindow, taskId)

    await testInvoke(mainWindow, 'browser:open-devtools', viewId, 'undocked')
    await expect.poll(() => testInvoke(mainWindow, 'browser:is-devtools-open', viewId)).toBe(true)

    await testInvoke(mainWindow, 'browser:close-devtools', viewId)
  })

  test('open devtools detached', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    const viewId = await getActiveViewId(mainWindow, taskId)

    await testInvoke(mainWindow, 'browser:open-devtools', viewId, 'detach')
    await expect.poll(() => testInvoke(mainWindow, 'browser:is-devtools-open', viewId)).toBe(true)

    await testInvoke(mainWindow, 'browser:close-devtools', viewId)
    await expect.poll(() => testInvoke(mainWindow, 'browser:is-devtools-open', viewId)).toBe(false)
  })

  test('close devtools is idempotent', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    const viewId = await getActiveViewId(mainWindow, taskId)

    // Close when already closed — should not throw
    await testInvoke(mainWindow, 'browser:close-devtools', viewId)
    const isOpen = await testInvoke(mainWindow, 'browser:is-devtools-open', viewId) as boolean
    expect(isOpen).toBe(false)
  })

  test('open devtools toggle cycle', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    const viewId = await getActiveViewId(mainWindow, taskId)

    // Open
    await testInvoke(mainWindow, 'browser:open-devtools', viewId, 'bottom')
    await expect.poll(() => testInvoke(mainWindow, 'browser:is-devtools-open', viewId)).toBe(true)

    // Close
    await testInvoke(mainWindow, 'browser:close-devtools', viewId)
    await expect.poll(() => testInvoke(mainWindow, 'browser:is-devtools-open', viewId)).toBe(false)

    // Re-open
    await testInvoke(mainWindow, 'browser:open-devtools', viewId, 'bottom')
    await expect.poll(() => testInvoke(mainWindow, 'browser:is-devtools-open', viewId)).toBe(true)

    // Final close
    await testInvoke(mainWindow, 'browser:close-devtools', viewId)
  })

  test('devtools on destroyed view returns false (not crash)', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)

    // Create a view, destroy it, then query devtools
    const viewId = await getActiveViewId(mainWindow, taskId)
    await testInvoke(mainWindow, 'browser:destroy-view', viewId)

    const isOpen = await testInvoke(mainWindow, 'browser:is-devtools-open', viewId) as boolean
    expect(isOpen).toBe(false)

    // Restore panel
    await ensureBrowserPanelHidden(mainWindow)
    await ensureBrowserPanelVisible(mainWindow)
  })

  test('open devtools on destroyed view does not crash', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    const viewId = await getActiveViewId(mainWindow, taskId)
    await testInvoke(mainWindow, 'browser:destroy-view', viewId)

    // Should not throw
    await testInvoke(mainWindow, 'browser:open-devtools', viewId, 'bottom')

    // Restore panel
    await ensureBrowserPanelHidden(mainWindow)
    await ensureBrowserPanelVisible(mainWindow)
  })
})
