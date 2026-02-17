import { test, expect, seed } from './fixtures/electron'
import { TEST_PROJECT_PATH } from './fixtures/electron'
import {
  getMainSessionId,
  openTaskTerminal,
  readFullBuffer,
  runCommand,
  switchTerminalMode,
  waitForBufferContains,
  waitForPtySession,
} from './fixtures/terminal'

test.describe('Terminal mode switch teardown', () => {
  let projectAbbrev: string
  let taskId: string

  test.beforeAll(async ({ mainWindow }) => {
    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'Mode Teardown', color: '#14b8a6', path: TEST_PROJECT_PATH })
    projectAbbrev = p.name.slice(0, 2).toUpperCase()

    const t = await s.createTask({ projectId: p.id, title: 'Mode teardown task', status: 'todo' })
    taskId = t.id

    await mainWindow.evaluate((id) => window.api.db.updateTask({ id, terminalMode: 'terminal' }), taskId)
    await s.refreshData()
  })

  test('kills previous session and issues create for the new mode', async ({ mainWindow }) => {
    const sessionId = getMainSessionId(taskId)
    const marker = `BEFORE_SWITCH_${Date.now()}`

    await openTaskTerminal(mainWindow, { projectAbbrev, taskTitle: 'Mode teardown task' })
    await waitForPtySession(mainWindow, sessionId)
    await runCommand(mainWindow, sessionId, `echo ${marker}`)
    await waitForBufferContains(mainWindow, sessionId, marker)

    await switchTerminalMode(mainWindow, 'codex')

    const task = await mainWindow.evaluate((id) => window.api.db.getTask(id), taskId)
    expect(task?.terminal_mode).toBe('codex')

    await waitForPtySession(mainWindow, sessionId)
    const postSwitchBuffer = await readFullBuffer(mainWindow, sessionId)
    expect(postSwitchBuffer).not.toContain(marker)

    await switchTerminalMode(mainWindow, 'terminal')
    await waitForPtySession(mainWindow, sessionId)
  })
})
