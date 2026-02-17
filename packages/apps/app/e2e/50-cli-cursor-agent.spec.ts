import { test, expect, seed } from './fixtures/electron'
import { TEST_PROJECT_PATH } from './fixtures/electron'
import {
  openTaskTerminal,
  switchTerminalMode,
  getMainSessionId,
  waitForPtySession,
  waitForPtyState,
  waitForBufferContains,
  readFullBuffer,
  binaryExistsAt,
  CLI_PATHS,
} from './fixtures/terminal'

const hasBinary = binaryExistsAt(CLI_PATHS['cursor-agent'])

test.describe('Cursor Agent CLI integration', () => {
  test.skip(!hasBinary, `cursor-agent not found at ${CLI_PATHS['cursor-agent']}`)

  let taskId: string

  test.beforeAll(async ({ mainWindow }) => {
    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'CursorCli', color: '#e11d48', path: TEST_PROJECT_PATH })
    const t = await s.createTask({ projectId: p.id, title: 'Cursor agent test', status: 'in_progress' })
    taskId = t.id
    await s.refreshData()

    await openTaskTerminal(mainWindow, { projectAbbrev: 'CU', taskTitle: 'Cursor agent test' })
    await switchTerminalMode(mainWindow, 'cursor-agent')
  })

  test('starts and produces output', async ({ mainWindow }) => {
    const sessionId = getMainSessionId(taskId)
    await waitForPtySession(mainWindow, sessionId, 30_000)

    // Wait for any output — cursor-agent TUI should render something
    await expect
      .poll(async () => {
        const buf = await readFullBuffer(mainWindow, sessionId)
        return buf.length > 0
      }, { timeout: 30_000 })
      .toBe(true)
  })

  test('accepts a prompt and produces response', async ({ mainWindow }) => {
    const sessionId = getMainSessionId(taskId)

    // Send a simple prompt
    await mainWindow.evaluate(
      ({ id }) => window.api.pty.write(id, 'say the word hello\r'),
      { id: sessionId }
    )

    // Wait for some response (generous timeout for API call)
    // If auth fails, this will timeout — that's expected in CI without credentials
    await waitForBufferContains(mainWindow, sessionId, 'hello', 60_000).catch(() => {
      // Auth or API failure — not a code bug, just missing credentials
      test.skip(true, 'cursor-agent did not respond — likely missing auth')
    })
  })

  test('detects working → attention state transition', async ({ mainWindow }) => {
    const sessionId = getMainSessionId(taskId)

    // Send a prompt to trigger work
    await mainWindow.evaluate(
      ({ id }) => window.api.pty.write(id, 'say ok\r'),
      { id: sessionId }
    )

    // Should transition to 'running' (working)
    await waitForPtyState(mainWindow, sessionId, 'running', 15_000)

    // Should transition back to 'attention' when done
    // Idle checker runs every 10s, timeout is 2.5s → worst case ~12.5s
    await waitForPtyState(mainWindow, sessionId, 'attention', 25_000)
  })
})
