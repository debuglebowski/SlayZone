/**
 * Failing-first regression suite for browser-panel WCV cleanup.
 *
 * Captures the bug: in-task browser tabs (WebContentsViews) leak in the
 * main-process registry across browser-tab close, task-tab switch, task-tab
 * close, and browser-panel toggle.
 *
 * Some assertions may pass (current React unmount chain catches some cases);
 * the failing ones identify the real leak surface.
 */
import { test, expect, seed, resetApp, TEST_PROJECT_PATH } from '../fixtures/electron'
import {
  newTabBtn,
  tabEntries,
  ensureBrowserPanelVisible,
  ensureBrowserPanelHidden,
  openTaskViaSearch,
  getViewsForTask,
  testInvoke,
} from '../fixtures/browser-view'

test.describe('Browser panel — WCV cleanup', () => {
  let projectId = ''

  test.beforeAll(async ({ mainWindow }) => {
    await resetApp(mainWindow)
    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'Browser Cleanup', color: '#0ea5e9', path: TEST_PROJECT_PATH })
    projectId = p.id
    await s.refreshData()
  })

  async function newTaskAndOpen(mainWindow: import('@playwright/test').Page, title: string): Promise<string> {
    const s = seed(mainWindow)
    const t = await s.createTask({ projectId, title, status: 'todo' })
    await s.refreshData()
    await openTaskViaSearch(mainWindow, title)
    return t.id
  }

  test('closing each browser tab via X destroys its WCV', async ({ mainWindow }) => {
    const taskId = await newTaskAndOpen(mainWindow, 'X-close task')
    await ensureBrowserPanelVisible(mainWindow)
    await newTabBtn(mainWindow).click()
    await newTabBtn(mainWindow).click()
    await expect.poll(async () => (await getViewsForTask(mainWindow, taskId)).length, { timeout: 10_000 }).toBe(3)

    // Close every tab via the X button. Browser panel auto-hides on last close.
    for (let i = 0; i < 3; i++) {
      const x = tabEntries(mainWindow).first().locator('button:has(.lucide-x)').first()
      await x.click()
    }

    await expect
      .poll(async () => (await getViewsForTask(mainWindow, taskId)).length, { timeout: 10_000 })
      .toBe(0)
  })

  test('closing a task tab destroys ALL its WCVs', async ({ mainWindow }) => {
    const taskId = await newTaskAndOpen(mainWindow, 'Task-close task')
    await ensureBrowserPanelVisible(mainWindow)
    await newTabBtn(mainWindow).click()
    await newTabBtn(mainWindow).click()
    await expect.poll(async () => (await getViewsForTask(mainWindow, taskId)).length, { timeout: 10_000 }).toBe(3)

    // Close the task tab via the same code path the X button + Cmd+W use.
    await mainWindow.evaluate((id) => {
      const w = window as unknown as {
        __slayzone_tabStore: { getState: () => { closeTabByTaskId: (id: string) => void } }
      }
      w.__slayzone_tabStore.getState().closeTabByTaskId(id)
    }, taskId)

    await expect
      .poll(async () => (await getViewsForTask(mainWindow, taskId)).length, { timeout: 10_000 })
      .toBe(0)
  })

  test('toggling browser panel off (Cmd+B) destroys WCVs for that task', async ({ mainWindow }) => {
    const taskId = await newTaskAndOpen(mainWindow, 'Panel-toggle task')
    await ensureBrowserPanelVisible(mainWindow)
    await newTabBtn(mainWindow).click()
    await expect.poll(async () => (await getViewsForTask(mainWindow, taskId)).length, { timeout: 10_000 }).toBe(2)

    await ensureBrowserPanelHidden(mainWindow)

    await expect
      .poll(async () => (await getViewsForTask(mainWindow, taskId)).length, { timeout: 10_000 })
      .toBe(0)
  })

  test('switching to another task tab does NOT destroy the inactive task WCVs (they hide)', async ({ mainWindow }) => {
    const taskA = await newTaskAndOpen(mainWindow, 'Active task')
    await ensureBrowserPanelVisible(mainWindow)
    await newTabBtn(mainWindow).click()
    await expect.poll(async () => (await getViewsForTask(mainWindow, taskA)).length, { timeout: 10_000 }).toBe(2)

    // Open a second task — switches active tab, but task A's BrowserPanel stays mounted (display:none)
    await newTaskAndOpen(mainWindow, 'Other task')

    // Inactive task's WCVs should remain allocated (hide-only semantics)
    const aCount = (await getViewsForTask(mainWindow, taskA)).length
    expect(aCount).toBe(2)
  })

  test('window focus does not re-attach hidden background-task WCVs', async ({ mainWindow }) => {
    // Regression: reparentView (added in secondary-window feat) used to call
    // addChildView unconditionally, surfacing hidden background WCVs on top of
    // the active task on every renderer-window focus event.
    const taskA = await newTaskAndOpen(mainWindow, 'Background WCV task')
    await ensureBrowserPanelVisible(mainWindow)
    await newTabBtn(mainWindow).click()
    await expect.poll(async () => (await getViewsForTask(mainWindow, taskA)).length, { timeout: 10_000 }).toBe(2)
    const aViewIds = await getViewsForTask(mainWindow, taskA)

    // Switch to another task → A's BrowserPanel goes display:none and its WCVs hide
    await newTaskAndOpen(mainWindow, 'Foreground task')

    // Hidden WCVs should not be natively attached
    await expect.poll(async () => {
      const list = (await testInvoke(mainWindow, 'browser:list-views')) as Array<{ viewId: string; nativelyAttached: boolean }>
      return list.filter((v) => aViewIds.includes(v.viewId)).every((v) => !v.nativelyAttached)
    }, { timeout: 10_000 }).toBe(true)

    // Simulate the user clicking out of and back into the app (window focus event)
    await mainWindow.evaluate(() => { window.dispatchEvent(new FocusEvent('focus')) })
    await mainWindow.waitForTimeout(200)

    // A's hidden WCVs must STILL not be attached after the focus event
    const list = (await testInvoke(mainWindow, 'browser:list-views')) as Array<{ viewId: string; nativelyAttached: boolean }>
    const reattached = list.filter((v) => aViewIds.includes(v.viewId) && v.nativelyAttached)
    expect(reattached, 'hidden background-task WCVs leaked back onto the active window').toEqual([])
  })

  test('closing then reopening a task does not leave orphan WCVs from the prior session', async ({ mainWindow }) => {
    const taskId = await newTaskAndOpen(mainWindow, 'Round-trip task')
    await ensureBrowserPanelVisible(mainWindow)
    await newTabBtn(mainWindow).click()
    await expect.poll(async () => (await getViewsForTask(mainWindow, taskId)).length, { timeout: 10_000 }).toBe(2)

    await mainWindow.evaluate((id) => {
      const w = window as unknown as {
        __slayzone_tabStore: { getState: () => { closeTabByTaskId: (id: string) => void } }
      }
      w.__slayzone_tabStore.getState().closeTabByTaskId(id)
    }, taskId)
    await expect
      .poll(async () => (await getViewsForTask(mainWindow, taskId)).length, { timeout: 10_000 })
      .toBe(0)

    // Reopen — should rehydrate from DB into a fresh set of WCVs, no orphans.
    await openTaskViaSearch(mainWindow, 'Round-trip task')
    await ensureBrowserPanelVisible(mainWindow)

    await expect
      .poll(async () => (await getViewsForTask(mainWindow, taskId)).length, { timeout: 10_000 })
      .toBe(2)
  })
})
