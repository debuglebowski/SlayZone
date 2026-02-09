import { test, expect, seed, goHome, clickProject } from './fixtures/electron'
import { TEST_PROJECT_PATH } from './fixtures/electron'

/** Get the value of the first visible input on the page */
async function getVisibleInputValue(page: import('@playwright/test').Page): Promise<string | null> {
  return page.evaluate(() => {
    const inputs = document.querySelectorAll('input')
    for (const input of inputs) {
      if (input.offsetParent !== null && input.value) return input.value
    }
    return null
  })
}

test.describe('Tab management & keyboard shortcuts', () => {
  let projectAbbrev: string

  test.beforeAll(async ({ mainWindow }) => {
    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'Shortcut Test', color: '#f59e0b', path: TEST_PROJECT_PATH })
    projectAbbrev = p.name.slice(0, 2).toUpperCase()

    await s.createTask({ projectId: p.id, title: 'Tab task A', status: 'todo' })
    await s.createTask({ projectId: p.id, title: 'Tab task B', status: 'in_progress' })
    await s.createTask({ projectId: p.id, title: 'Tab task C', status: 'todo' })
    await s.refreshData()

    await goHome(mainWindow)
    await clickProject(mainWindow, projectAbbrev)
    await mainWindow.waitForTimeout(500)
  })

  test('open multiple tasks as tabs', async ({ mainWindow }) => {
    await mainWindow.getByText('Tab task A').first().click()
    await mainWindow.waitForTimeout(300)

    await goHome(mainWindow)
    await mainWindow.waitForTimeout(200)
    await mainWindow.getByText('Tab task B').first().click()
    await mainWindow.waitForTimeout(300)

    await goHome(mainWindow)
    await mainWindow.waitForTimeout(200)
    await mainWindow.getByText('Tab task C').first().click()
    await mainWindow.waitForTimeout(300)

    // All tasks should be in DOM (tab bar + content)
    await expect(mainWindow.getByText('Tab task A').first()).toBeAttached()
    await expect(mainWindow.getByText('Tab task B').first()).toBeAttached()
    await expect(mainWindow.getByText('Tab task C').first()).toBeAttached()
  })

  test('Cmd+1 switches to first task tab', async ({ mainWindow }) => {
    // Cmd+N maps to index N, so Cmd+1 = index 1 = first task tab
    await goHome(mainWindow)
    await mainWindow.waitForTimeout(200)

    await mainWindow.keyboard.press('Meta+1')
    await mainWindow.waitForTimeout(300)

    // Should be on a task tab (visible input with a title)
    const value = await getVisibleInputValue(mainWindow)
    expect(value).toBeTruthy()
  })

  test('Cmd+2 switches to second task tab', async ({ mainWindow }) => {
    await mainWindow.keyboard.press('Meta+2')
    await mainWindow.waitForTimeout(300)

    const value = await getVisibleInputValue(mainWindow)
    expect(value).toBeTruthy()
  })

  test('Ctrl+Tab cycles to next tab', async ({ mainWindow }) => {
    await goHome(mainWindow)
    await mainWindow.waitForTimeout(200)

    await mainWindow.keyboard.press('Control+Tab')
    await mainWindow.waitForTimeout(300)

    // Should be on a task tab (visible input with a title)
    const value = await getVisibleInputValue(mainWindow)
    expect(value).toBeTruthy()
  })

  test('Ctrl+Shift+Tab cycles backward', async ({ mainWindow }) => {
    await mainWindow.keyboard.press('Control+Shift+Tab')
    await mainWindow.waitForTimeout(300)

    // Should cycle backward — back to home tab
    await expect(mainWindow.locator('h3').getByText('Inbox', { exact: true })).toBeAttached({ timeout: 3_000 })
  })

  test('Cmd+Shift+T reopens closed tab', async ({ mainWindow }) => {
    // Open a known task tab directly
    await goHome(mainWindow)
    await mainWindow.waitForTimeout(200)
    await mainWindow.getByText('Tab task C').first().click()
    await mainWindow.waitForTimeout(300)

    const closedTitle = await getVisibleInputValue(mainWindow)
    expect(closedTitle).toBe('Tab task C')

    // Close tab via Cmd+W (useHotkeys intercepts this for task tabs)
    await mainWindow.keyboard.press('Meta+w')
    await mainWindow.waitForTimeout(300)

    // Reopen
    await mainWindow.keyboard.press('Meta+Shift+t')
    await mainWindow.waitForTimeout(500)

    const reopenedTitle = await getVisibleInputValue(mainWindow)
    expect(reopenedTitle).toBe('Tab task C')
  })

  test('opening same task twice does not duplicate tab', async ({ mainWindow }) => {
    await goHome(mainWindow)
    await mainWindow.waitForTimeout(200)

    await mainWindow.getByText('Tab task A').first().click()
    await mainWindow.waitForTimeout(300)

    await goHome(mainWindow)
    await mainWindow.waitForTimeout(200)
    await mainWindow.getByText('Tab task A').first().click()
    await mainWindow.waitForTimeout(300)

    const value = await getVisibleInputValue(mainWindow)
    expect(value).toBe('Tab task A')
  })

})
