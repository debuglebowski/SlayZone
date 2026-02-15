import { test, expect, seed } from './fixtures/electron'
import { TEST_PROJECT_PATH } from './fixtures/electron'
import {
  getMainSessionId,
  openTaskTerminal,
  runCommand,
  waitForBufferContains,
  waitForNoPtySession,
  waitForPtySession,
} from './fixtures/terminal'

test.describe('Trailing PTY output on exit', () => {
  let projectAbbrev: string
  let taskId: string

  test.beforeAll(async ({ mainWindow }) => {
    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'Ux Trailing', color: '#f97316', path: TEST_PROJECT_PATH })
    projectAbbrev = p.name.slice(0, 2).toUpperCase()

    const t = await s.createTask({ projectId: p.id, title: 'Trailing output task', status: 'todo' })
    taskId = t.id

    await mainWindow.evaluate((id) => window.api.db.updateTask({ id, terminalMode: 'terminal' }), taskId)
    await s.refreshData()
  })

  test('captures final output from a fast-exiting process', async ({ mainWindow }) => {
    const marker = `TRAILING_${Date.now()}`

    await openTaskTerminal(mainWindow, { projectAbbrev, taskTitle: 'Trailing output task' })

    const sessionId = getMainSessionId(taskId)
    await waitForPtySession(mainWindow, sessionId)

    // Run a command that outputs a marker and exits immediately.
    // Without the delayed session cleanup, the final onData may be dropped.
    await runCommand(mainWindow, sessionId, `echo ${marker} && exit 0`)
    await waitForBufferContains(mainWindow, sessionId, marker)
    await waitForNoPtySession(mainWindow, sessionId)
  })
})
