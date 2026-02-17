import { test, expect, seed, goHome, clickProject } from './fixtures/electron'
import { TEST_PROJECT_PATH } from './fixtures/electron'
import { switchTerminalMode, openTaskTerminal } from './fixtures/terminal'

/**
 * Tests the session ID banner system across all provider types:
 * - Codex/Gemini: detect banner with command button
 * - Cursor/OpenCode: unavailable banner (closable)
 * - Claude Code/Terminal: no banner
 */
test.describe('Session ID banners', () => {
  let projectAbbrev: string
  let codexTaskId: string
  let geminiTaskId: string
  let cursorTaskId: string
  let opencodeTaskId: string
  let claudeTaskId: string

  const detectedId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

  test.beforeAll(async ({ electronApp, mainWindow }) => {
    // Mock PTY handlers so we don't need real CLIs
    await electronApp.evaluate(({ ipcMain }, sessionIdFromStatus: string) => {
      const globalState = globalThis as unknown as {
        __statusBuffers?: Record<string, string>
        __statusCommandCounts?: Record<string, number>
      }
      globalState.__statusBuffers = {}
      globalState.__statusCommandCounts = {}

      ipcMain.removeHandler('pty:create')
      ipcMain.handle('pty:create', async () => ({ success: true }))

      ipcMain.removeHandler('pty:write')
      ipcMain.handle('pty:write', async (event, sessionId: string, data: string) => {
        const buffers = globalState.__statusBuffers ?? {}
        const counts = globalState.__statusCommandCounts ?? {}
        buffers[sessionId] = (buffers[sessionId] ?? '') + data

        if (data.includes('\r') || data.includes('\n')) {
          const line = buffers[sessionId]
          if (line.includes('/status') || line.includes('/stats')) {
            counts[sessionId] = (counts[sessionId] ?? 0) + 1
            event.sender.send('pty:session-detected', sessionId, sessionIdFromStatus)
          }
          buffers[sessionId] = ''
        }

        globalState.__statusBuffers = buffers
        globalState.__statusCommandCounts = counts
        return true
      })

      ipcMain.removeHandler('pty:exists')
      ipcMain.handle('pty:exists', async () => true)
    }, detectedId)

    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'Banner Tests', color: '#0ea5e9', path: TEST_PROJECT_PATH })
    projectAbbrev = p.name.slice(0, 2).toUpperCase()

    const codexTask = await s.createTask({ projectId: p.id, title: 'BT codex task', status: 'todo' })
    const geminiTask = await s.createTask({ projectId: p.id, title: 'BT gemini task', status: 'todo' })
    const cursorTask = await s.createTask({ projectId: p.id, title: 'BT cursor task', status: 'todo' })
    const opencodeTask = await s.createTask({ projectId: p.id, title: 'BT opencode task', status: 'todo' })
    const claudeTask = await s.createTask({ projectId: p.id, title: 'BT claude task', status: 'todo' })
    codexTaskId = codexTask.id
    geminiTaskId = geminiTask.id
    cursorTaskId = cursorTask.id
    opencodeTaskId = opencodeTask.id
    claudeTaskId = claudeTask.id

    await mainWindow.evaluate(({ codex, gemini, cursor, opencode }) => {
      return Promise.all([
        window.api.db.updateTask({ id: codex, terminalMode: 'codex' }),
        window.api.db.updateTask({ id: gemini, terminalMode: 'gemini' }),
        window.api.db.updateTask({ id: cursor, terminalMode: 'cursor-agent' }),
        window.api.db.updateTask({ id: opencode, terminalMode: 'opencode' }),
        // claude task stays as default claude-code
      ])
    }, { codex: codexTaskId, gemini: geminiTaskId, cursor: cursorTaskId, opencode: opencodeTaskId })

    await s.refreshData()
    await goHome(mainWindow)
    await clickProject(mainWindow, projectAbbrev)
    await mainWindow.waitForTimeout(500)
  })

  test.afterAll(async ({ electronApp }) => {
    await electronApp.evaluate(() => {
      const restore = (globalThis as unknown as { __restorePtyHandlers?: () => void }).__restorePtyHandlers
      restore?.()
    })
  })

  // --- Codex: detect banner with /status ---

  test('codex: shows detect banner with /status button', async ({ mainWindow }) => {
    await mainWindow.getByText('BT codex task').first().click()
    await mainWindow.waitForTimeout(500)

    await expect(mainWindow.getByText('Session not saved')).toBeVisible()
    await expect(mainWindow.getByRole('button', { name: /Run \/status/ })).toBeVisible()
  })

  test('codex: clicking detect button saves session id and hides banner', async ({ mainWindow }) => {
    await mainWindow.getByRole('button', { name: /Run \/status/ }).click()

    await expect
      .poll(async () => {
        const task = await mainWindow.evaluate((id) => window.api.db.getTask(id), codexTaskId)
        return task?.codex_conversation_id ?? null
      })
      .toBe(detectedId)

    await expect(mainWindow.getByText('Session not saved')).not.toBeVisible()
  })

  // --- Gemini: detect banner with /stats ---

  test('gemini: shows detect banner with /stats button', async ({ mainWindow }) => {
    await goHome(mainWindow)
    await clickProject(mainWindow, projectAbbrev)
    await mainWindow.waitForTimeout(300)
    await mainWindow.getByText('BT gemini task').first().click()
    await mainWindow.waitForTimeout(500)

    await expect(mainWindow.getByText('Session not saved')).toBeVisible()
    await expect(mainWindow.getByRole('button', { name: /Run \/stats/ })).toBeVisible()
  })

  test('gemini: clicking detect button saves session id', async ({ mainWindow }) => {
    await mainWindow.getByRole('button', { name: /Run \/stats/ }).click()

    await expect
      .poll(async () => {
        const task = await mainWindow.evaluate((id) => window.api.db.getTask(id), geminiTaskId)
        return task?.gemini_conversation_id ?? null
      })
      .toBe(detectedId)

    await expect(mainWindow.getByText('Session not saved')).not.toBeVisible()
  })

  // --- Cursor Agent: unavailable banner ---

  test('cursor: shows unavailable banner (not detect banner)', async ({ mainWindow }) => {
    await goHome(mainWindow)
    await clickProject(mainWindow, projectAbbrev)
    await mainWindow.waitForTimeout(300)
    await mainWindow.getByText('BT cursor task').first().click()
    await mainWindow.waitForTimeout(500)

    await expect(mainWindow.getByText(/Session ID detection not available/)).toBeVisible()
    await expect(mainWindow.getByText(/don't close the tab/)).toBeVisible()
    await expect(mainWindow.getByText(/Claude Code, Codex, Gemini/)).toBeVisible()
    // No detect button
    await expect(mainWindow.getByRole('button', { name: /Run \/status/ })).not.toBeVisible()
  })

  test('cursor: unavailable banner is closable', async ({ mainWindow }) => {
    // Find and click the X button inside the banner
    const banner = mainWindow.getByText(/Session ID detection not available/).locator('..')
    await banner.locator('button').click()

    await expect(mainWindow.getByText(/Session ID detection not available/)).not.toBeVisible()
  })

  // --- OpenCode: unavailable banner ---

  test('opencode: shows unavailable banner', async ({ mainWindow }) => {
    await goHome(mainWindow)
    await clickProject(mainWindow, projectAbbrev)
    await mainWindow.waitForTimeout(300)
    await mainWindow.getByText('BT opencode task').first().click()
    await mainWindow.waitForTimeout(500)

    await expect(mainWindow.getByText(/Session ID detection not available/)).toBeVisible()
    await expect(mainWindow.getByText(/don't close the tab/)).toBeVisible()
  })

  test('opencode: unavailable banner is closable', async ({ mainWindow }) => {
    const banner = mainWindow.getByText(/Session ID detection not available/).locator('..')
    await banner.locator('button').click()

    await expect(mainWindow.getByText(/Session ID detection not available/)).not.toBeVisible()
  })

  // --- Claude Code: no banner ---

  test('claude-code: no session banner of any kind', async ({ mainWindow }) => {
    await goHome(mainWindow)
    await clickProject(mainWindow, projectAbbrev)
    await mainWindow.waitForTimeout(300)
    await mainWindow.getByText('BT claude task').first().click()
    await mainWindow.waitForTimeout(500)

    await expect(mainWindow.getByText('Session not saved')).not.toBeVisible()
    await expect(mainWindow.getByText(/Session ID detection not available/)).not.toBeVisible()
  })
})
