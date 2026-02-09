import { test, expect, seed, goHome, clickProject } from './fixtures/electron'
import { TEST_PROJECT_PATH } from './fixtures/electron'

test.describe('Codex status retry', () => {
  let projectAbbrev: string
  let taskId: string

  const detectedId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

  test.beforeAll(async ({ electronApp, mainWindow }) => {
    await electronApp.evaluate(({ ipcMain }, sessionIdFromStatus: string) => {
      const globalState = globalThis as unknown as {
        __statusBuffers?: Record<string, string>
        __statusCommandCounts?: Record<string, number>
        __statusReady?: Record<string, boolean>
        __statusSeq?: Record<string, number>
        __sessionExists?: Record<string, boolean>
      }
      globalState.__statusBuffers = {}
      globalState.__statusCommandCounts = {}
      globalState.__statusReady = {}
      globalState.__statusSeq = {}
      globalState.__sessionExists = {}

      ipcMain.removeHandler('pty:create')
      ipcMain.handle('pty:create', async (event, sessionId: string) => {
        const ready = globalState.__statusReady ?? {}
        const seqMap = globalState.__statusSeq ?? {}
        const existing = globalState.__sessionExists ?? {}
        ready[sessionId] = false
        seqMap[sessionId] = 0
        existing[sessionId] = true
        globalState.__statusReady = ready
        globalState.__statusSeq = seqMap
        globalState.__sessionExists = existing

        // Simulate Codex warming up: it only accepts commands after first output.
        setTimeout(() => {
          const latestReady = globalState.__statusReady ?? {}
          const latestSeqMap = globalState.__statusSeq ?? {}
          latestReady[sessionId] = true
          latestSeqMap[sessionId] = (latestSeqMap[sessionId] ?? 0) + 1
          globalState.__statusReady = latestReady
          globalState.__statusSeq = latestSeqMap
          event.sender.send('pty:data', sessionId, 'Codex boot complete\r\n', latestSeqMap[sessionId])
        }, 1200)

        return { success: true }
      })

      ipcMain.removeHandler('pty:write')
      ipcMain.handle('pty:write', async (event, sessionId: string, data: string) => {
        const buffers = globalState.__statusBuffers ?? {}
        const counts = globalState.__statusCommandCounts ?? {}
        const ready = globalState.__statusReady ?? {}
        buffers[sessionId] = (buffers[sessionId] ?? '') + data

        if (data.includes('\r') || data.includes('\n')) {
          if (buffers[sessionId].includes('/status')) {
            counts[sessionId] = (counts[sessionId] ?? 0) + 1
            if (ready[sessionId]) {
              event.sender.send('pty:session-detected', sessionId, sessionIdFromStatus)
            }
          }
          buffers[sessionId] = ''
        }

        globalState.__statusBuffers = buffers
        globalState.__statusCommandCounts = counts
        return true
      })

      ipcMain.removeHandler('pty:exists')
      ipcMain.handle('pty:exists', async (_event, sessionId: string) => {
        const existing = globalState.__sessionExists ?? {}
        return !!existing[sessionId]
      })
    }, detectedId)

    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'Zed Retry', color: '#22c55e', path: TEST_PROJECT_PATH })
    projectAbbrev = p.name.slice(0, 2).toUpperCase()

    const created = await s.createTask({ projectId: p.id, title: 'Codex delayed status retry', status: 'todo' })
    taskId = created.id

    await mainWindow.evaluate((id) => {
      return window.api.db.updateTask({ id, terminalMode: 'codex', codexConversationId: null })
    }, taskId)

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

  test('auto-status eventually detects session id without user pressing enter', async ({ mainWindow, electronApp }) => {
    await mainWindow.getByText('Codex delayed status retry').first().click()

    await expect
      .poll(async () => {
        const task = await mainWindow.evaluate((id) => window.api.db.getTask(id), taskId)
        return task?.codex_conversation_id ?? null
      }, { timeout: 15000 })
      .toBe(detectedId)

    const statusCount = await electronApp.evaluate(() => {
      const counts = (globalThis as unknown as { __statusCommandCounts?: Record<string, number> }).__statusCommandCounts ?? {}
      return Object.values(counts).reduce((sum, value) => sum + value, 0)
    })
    expect(statusCount).toBeGreaterThan(0)
  })
})
