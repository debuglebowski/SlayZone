import { test, expect, seed } from './fixtures/electron'
import { TEST_PROJECT_PATH } from './fixtures/electron'
import {
  getMainSessionId,
  openTaskTerminal,
  runCommand,
  waitForBufferContains,
  waitForPtySession,
  waitForPtyState,
} from './fixtures/terminal'

test.describe('Terminal state behavior', () => {
  let projectAbbrev: string
  let taskId: string

  test.beforeAll(async ({ mainWindow }) => {
    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'Terminal State', color: '#eab308', path: TEST_PROJECT_PATH })
    projectAbbrev = p.name.slice(0, 2).toUpperCase()

    const t = await s.createTask({ projectId: p.id, title: 'State transition task', status: 'todo' })
    taskId = t.id

    await mainWindow.evaluate((id) => window.api.db.updateTask({ id, terminalMode: 'terminal' }), taskId)
    await s.refreshData()
  })

  test('reaches attention after startup and stays healthy after command execution', async ({ mainWindow }) => {
    const marker = `STATE_${Date.now()}`

    await openTaskTerminal(mainWindow, { projectAbbrev, taskTitle: 'State transition task' })

    const sessionId = getMainSessionId(taskId)
    await waitForPtySession(mainWindow, sessionId)

    const initialState = await mainWindow.evaluate((id) => window.api.pty.getState(id), sessionId)
    expect(['starting', 'attention']).toContain(initialState)

    await waitForPtyState(mainWindow, sessionId, 'attention')

    await runCommand(mainWindow, sessionId, `echo ${marker}`)
    await waitForBufferContains(mainWindow, sessionId, marker)

    await expect
      .poll(async () => mainWindow.evaluate((id) => window.api.pty.getState(id), sessionId))
      .toBe('attention')
  })
})
