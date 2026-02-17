import { test, expect, seed } from './fixtures/electron'
import { TEST_PROJECT_PATH } from './fixtures/electron'
import {
  getMainSessionId,
  openTaskTerminal,
  readFullBuffer,
  runCommand,
  waitForBufferContains,
  waitForPtySession,
  waitForPtyState,
} from './fixtures/terminal'

test.describe('Terminal clear buffer', () => {
  let projectAbbrev: string
  let taskId: string

  test.beforeAll(async ({ mainWindow }) => {
    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'Delta Clear', color: '#0ea5e9', path: TEST_PROJECT_PATH })
    projectAbbrev = p.name.slice(0, 2).toUpperCase()

    const t = await s.createTask({ projectId: p.id, title: 'Clear buffer task', status: 'in_progress' })
    taskId = t.id

    await mainWindow.evaluate((id) => window.api.db.updateTask({ id, terminalMode: 'terminal' }), taskId)
    await s.refreshData()
  })

  test('clears buffer without killing PTY', async ({ mainWindow }) => {
    const markerA = `CLEAR_A_${Date.now()}`
    const markerB = `CLEAR_B_${Date.now()}`

    await openTaskTerminal(mainWindow, { projectAbbrev, taskTitle: 'Clear buffer task' })

    const sessionId = getMainSessionId(taskId)
    await waitForPtySession(mainWindow, sessionId)

    await runCommand(mainWindow, sessionId, `echo ${markerA}`)
    await waitForBufferContains(mainWindow, sessionId, markerA)
    // Wait for shell to be idle (prompt displayed = all PTY output flushed)
    await waitForPtyState(mainWindow, sessionId, 'attention')

    await mainWindow.evaluate((id) => window.api.pty.clearBuffer(id), sessionId)

    await expect.poll(async () => mainWindow.evaluate((id) => window.api.pty.exists(id), sessionId)).toBe(true)
    // Re-clear until buffer is free of marker A (in case of late PTY data)
    await expect.poll(async () => {
      const buffer = await readFullBuffer(mainWindow, sessionId)
      if (buffer.includes(markerA)) {
        await mainWindow.evaluate((id) => window.api.pty.clearBuffer(id), sessionId)
        return false
      }
      return true
    }, { timeout: 5_000 }).toBe(true)

    await runCommand(mainWindow, sessionId, `echo ${markerB}`)
    await waitForBufferContains(mainWindow, sessionId, markerB)

    const buffer = await readFullBuffer(mainWindow, sessionId)
    expect(buffer).not.toContain(markerA)
    expect(buffer).toContain(markerB)
  })
})
