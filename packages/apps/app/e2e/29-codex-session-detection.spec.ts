import { test, expect, seed, goHome, clickProject } from './fixtures/electron'
import { TEST_PROJECT_PATH } from './fixtures/electron'

test.describe('Codex session detection', () => {
  let projectAbbrev: string
  let autoTaskId: string
  let manualTaskId: string

  const detectedId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

  test.beforeAll(async ({ electronApp, mainWindow }) => {
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
          if (buffers[sessionId].includes('/status')) {
            counts[sessionId] = (counts[sessionId] ?? 0) + 1
            event.sender.send('pty:session-detected', sessionId, sessionIdFromStatus)
          }
          buffers[sessionId] = ''
        }

        globalState.__statusBuffers = buffers
        globalState.__statusCommandCounts = counts
        return true
      })
    }, detectedId)

    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'Codex Status', color: '#0ea5e9', path: TEST_PROJECT_PATH })
    projectAbbrev = p.name.slice(0, 2).toUpperCase()

    const autoTask = await s.createTask({ projectId: p.id, title: 'Codex auto status', status: 'todo' })
    const manualTask = await s.createTask({ projectId: p.id, title: 'Codex manual status', status: 'todo' })
    autoTaskId = autoTask.id
    manualTaskId = manualTask.id

    await mainWindow.evaluate(({ autoId, manualId }) => {
      return Promise.all([
        window.api.db.updateTask({ id: autoId, terminalMode: 'codex', codexConversationId: null }),
        window.api.db.updateTask({
          id: manualId,
          terminalMode: 'codex',
          codexConversationId: '11111111-2222-4333-8444-555555555555'
        })
      ])
    }, { autoId: autoTaskId, manualId: manualTaskId })

    await s.refreshData()
    await goHome(mainWindow)
    await clickProject(mainWindow, projectAbbrev)
    await mainWindow.waitForTimeout(500)
  })

  test('auto-requests /status for codex terminal without stored conversation id', async ({ mainWindow, electronApp }) => {
    await mainWindow.getByText('Codex auto status').first().click()

    await expect
      .poll(async () => {
        const task = await mainWindow.evaluate((id) => window.api.db.getTask(id), autoTaskId)
        return task?.codex_conversation_id ?? null
      })
      .toBe(detectedId)

    const statusCount = await electronApp.evaluate(() => {
      const counts = (globalThis as unknown as { __statusCommandCounts?: Record<string, number> }).__statusCommandCounts ?? {}
      return Object.values(counts).reduce((sum, value) => sum + value, 0)
    })
    expect(statusCount).toBeGreaterThan(0)
  })

  test('running /status updates codex_conversation_id', async ({ mainWindow }) => {
    await goHome(mainWindow)
    await clickProject(mainWindow, projectAbbrev)
    await mainWindow.waitForTimeout(300)

    await mainWindow.getByText('Codex manual status').first().click()
    await mainWindow.waitForTimeout(300)

    await mainWindow.evaluate(async (sessionId) => {
      await window.api.pty.write(sessionId, '/status')
      await window.api.pty.write(sessionId, '\r')
    }, `${manualTaskId}:${manualTaskId}`)

    await expect
      .poll(async () => {
        const task = await mainWindow.evaluate((id) => window.api.db.getTask(id), manualTaskId)
        return task?.codex_conversation_id ?? null
      })
      .toBe(detectedId)
  })
})
