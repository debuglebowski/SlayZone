/**
 * Terminal cursor stability — verifies no unexpected cursor jumping or blank
 * lines when creating a new temporary task (claude-code mode, the default).
 */
import { test, expect, seed, resetApp, clickProject } from './fixtures/electron'
import { TEST_PROJECT_PATH } from './fixtures/electron'
import {
  getMainSessionId,
  waitForPtySession,
  getTerminalState,
  binaryOnPath,
} from './fixtures/terminal'

const hasClaude = binaryOnPath('claude')

test.describe('Temporary task cursor stability', () => {
  test.skip(!hasClaude, 'claude binary not found')

  let projectId: string
  let projectAbbrev: string

  test.beforeAll(async ({ mainWindow }) => {
    await resetApp(mainWindow)
    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'Cursor Stab', color: '#f97316', path: TEST_PROJECT_PATH })
    projectId = p.id
    projectAbbrev = p.name.slice(0, 2).toUpperCase()
    await s.refreshData()
  })

  test('no blank lines between Claude Code header and prompt', async ({ mainWindow }) => {
    // Select the project first (required for temp task creation)
    await clickProject(mainWindow, projectAbbrev)

    // Create temporary task the same way the UI does
    const task = await mainWindow.evaluate(async (pId) => {
      return window.api.db.createTask({
        projectId: pId,
        title: 'Terminal 1',
        status: 'in_progress',
        isTemporary: true,
      })
    }, projectId)

    // Open it via the tab store (mirrors handleCreateScratchTerminal)
    await mainWindow.evaluate((taskId) => {
      const store = (window as any).__slayzone_tabStore
      if (!store) throw new Error('tabStore not exposed')
      const lookup = store.getState()._taskLookup
      store.setState({ _taskLookup: { ...lookup, tasks: [{ id: taskId, title: 'Terminal 1', is_temporary: true }, ...lookup.tasks] } })
      store.getState().openTask(taskId)
    }, task.id)

    const sessionId = getMainSessionId(task.id)
    await waitForPtySession(mainWindow, sessionId, 30_000)

    // Wait for Claude Code prompt (❯ character)
    await expect.poll(async () => {
      const state = await getTerminalState(mainWindow, sessionId)
      if (!state) return false
      return state.lines.some(l => l.includes('❯'))
    }, { timeout: 30_000 }).toBe(true)

    const state = await getTerminalState(mainWindow, sessionId)
    expect(state).toBeTruthy()

    // Find the prompt line and the last header line (directory path)
    const promptIdx = state!.lines.findIndex(l => l.includes('❯'))
    const headerLines = state!.lines.slice(0, promptIdx)

    // Find last non-empty header line (the working directory line)
    const lastHeaderIdx = headerLines.reduce((last, l, i) => l.trim() ? i : last, -1)

    // Between the last header line and prompt, there should be at most 1 blank line
    // (Claude Code renders: header, blank line, prompt). More indicates cursor jumped.
    const gap = promptIdx - lastHeaderIdx - 1
    expect(gap).toBeLessThanOrEqual(1)
  })
})
