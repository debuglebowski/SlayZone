import { test, expect, seed } from './fixtures/electron'
import { TEST_PROJECT_PATH } from './fixtures/electron'
import {
  getMainSessionId,
  openTaskTerminal,
  waitForPtySession,
} from './fixtures/terminal'

test.describe('Terminal error handling', () => {
  let projectAbbrev: string
  let taskId: string

  test.beforeAll(async ({ mainWindow }) => {
    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'Terminal Error', color: '#ef4444', path: TEST_PROJECT_PATH })
    projectAbbrev = p.name.slice(0, 2).toUpperCase()

    const t = await s.createTask({ projectId: p.id, title: 'Terminal error task', status: 'todo' })
    taskId = t.id

    await mainWindow.evaluate((id) => window.api.db.updateTask({ id, terminalMode: 'terminal' }), taskId)
    await s.refreshData()
  })

  test.afterAll(async ({ mainWindow }) => {
    await mainWindow.evaluate(() => window.api.settings.set('shell', ''))
  })

  test('shows startup error for invalid shell and recovers after shell reset', async ({ mainWindow }) => {
    const sessionId = getMainSessionId(taskId)

    await mainWindow.evaluate(() => window.api.settings.set('shell', '/definitely/not/a/real/shell'))

    await openTaskTerminal(mainWindow, { projectAbbrev, taskTitle: 'Terminal error task' })

    await expect(mainWindow.getByText(/Failed to start terminal:/)).toBeVisible()
    await expect
      .poll(async () => mainWindow.evaluate((id) => window.api.pty.exists(id), sessionId))
      .toBe(false)

    await mainWindow.evaluate(() => window.api.settings.set('shell', ''))

    await openTaskTerminal(mainWindow, { projectAbbrev, taskTitle: 'Terminal error task' })

    await expect(mainWindow.getByText(/Failed to start terminal:/)).not.toBeVisible()
    await waitForPtySession(mainWindow, sessionId)
  })
})
