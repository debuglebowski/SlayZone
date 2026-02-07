import { test, expect, seed } from './fixtures/electron'
import { TEST_PROJECT_PATH } from './fixtures/electron'
import {
  getMainSessionId,
  getTabSessionId,
  openTaskTerminal,
  waitForNoPtySession,
  waitForPtySession,
} from './fixtures/terminal'

test.describe('Terminal tab lifecycle', () => {
  let projectAbbrev: string
  let taskId: string

  test.beforeAll(async ({ mainWindow }) => {
    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'Terminal Tabs', color: '#06b6d4', path: TEST_PROJECT_PATH })
    projectAbbrev = p.name.slice(0, 2).toUpperCase()

    const t = await s.createTask({ projectId: p.id, title: 'Terminal tab task', status: 'todo' })
    taskId = t.id

    await mainWindow.evaluate((id) => window.api.db.updateTask({ id, terminalMode: 'terminal' }), taskId)
    await s.refreshData()
  })

  test('create/close tab updates DB and PTY lifecycle; main tab cannot be deleted', async ({ mainWindow }) => {
    await openTaskTerminal(mainWindow, { projectAbbrev, taskTitle: 'Terminal tab task' })

    const mainSessionId = getMainSessionId(taskId)
    await waitForPtySession(mainWindow, mainSessionId)

    await mainWindow.getByTestId('terminal-tab-add').click()

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

    const nonMainSessionId = getTabSessionId(taskId, nonMainTabId)
    await waitForPtySession(mainWindow, nonMainSessionId)

    await mainWindow.getByTestId(`terminal-tab-${nonMainTabId}`).hover()
    await mainWindow.getByTestId(`terminal-tab-close-${nonMainTabId}`).click()

    await waitForNoPtySession(mainWindow, nonMainSessionId)

    await expect
      .poll(async () => {
        const tabs = await mainWindow.evaluate((id) => window.api.tabs.list(id), taskId)
        return tabs.length
      })
      .toBe(1)

    const canDeleteMain = await mainWindow.evaluate((id) => window.api.tabs.delete(id), taskId)
    expect(canDeleteMain).toBe(false)
  })
})
