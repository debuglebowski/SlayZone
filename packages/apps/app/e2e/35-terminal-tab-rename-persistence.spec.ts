import { test, expect, seed, clickProject, goHome } from './fixtures/electron'
import { TEST_PROJECT_PATH } from './fixtures/electron'
import { openTaskTerminal } from './fixtures/terminal'

test.describe('Terminal tab rename persistence', () => {
  let projectAbbrev: string
  let taskId: string

  test.beforeAll(async ({ mainWindow }) => {
    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'Tab Rename', color: '#3b82f6', path: TEST_PROJECT_PATH })
    projectAbbrev = p.name.slice(0, 2).toUpperCase()

    const t = await s.createTask({ projectId: p.id, title: 'Tab rename task', status: 'todo' })
    taskId = t.id

    await mainWindow.evaluate((id) => window.api.db.updateTask({ id, terminalMode: 'terminal' }), taskId)
    await s.refreshData()
  })

  test('renamed non-main tab persists in DB and after navigation', async ({ mainWindow }) => {
    const label = `Renamed ${Date.now()}`

    await openTaskTerminal(mainWindow, { projectAbbrev, taskTitle: 'Tab rename task' })
    await mainWindow.locator('[data-testid="terminal-tabbar"]:visible [data-testid="terminal-tab-add"]').first().click()

    await expect
      .poll(async () => {
        const tabs = await mainWindow.evaluate((id) => window.api.tabs.list(id), taskId)
        const nonMain = tabs.find((tab: { id: string; isMain: boolean }) => !tab.isMain)
        return nonMain?.id ?? null
      })
      .not.toBeNull()

    const tabs = await mainWindow.evaluate((id) => window.api.tabs.list(id), taskId)
    const nonMainTab = tabs.find((tab: { id: string; isMain: boolean }) => !tab.isMain)
    expect(nonMainTab).toBeTruthy()
    const nonMainTabId = nonMainTab!.id

    const tab = mainWindow.getByTestId(`terminal-tab-${nonMainTabId}`)
    await tab.dblclick()
    const input = tab.locator('input')
    await expect(input).toBeVisible()
    await input.fill(label)
    await input.press('Enter')

    await expect(tab.getByText(label)).toBeVisible()

    await expect
      .poll(async () => {
        const list = await mainWindow.evaluate((id) => window.api.tabs.list(id), taskId)
        const renamed = list.find((t: { id: string }) => t.id === nonMainTabId)
        return renamed?.label ?? null
      })
      .toBe(label)

    await goHome(mainWindow)
    await clickProject(mainWindow, projectAbbrev)
    await mainWindow.getByText('Tab rename task').first().click()
    await expect(mainWindow.locator('[data-testid="terminal-tabbar"]:visible').first()).toBeVisible()

    await expect(mainWindow.getByTestId(`terminal-tab-${nonMainTabId}`).getByText(label)).toBeVisible()
  })
})
