import { test, expect, seed } from './fixtures/electron'
import { TEST_PROJECT_PATH } from './fixtures/electron'
import { getMainSessionId, openTaskTerminal, switchTerminalMode, waitForPtySession } from './fixtures/terminal'

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

    await openTaskTerminal(mainWindow, { projectAbbrev, taskTitle: 'Mode teardown task' })
    await waitForPtySession(mainWindow, sessionId)

    await mainWindow.evaluate(() => {
      type SpyState = {
        kills: string[]
        creates: Array<{ sessionId: string; mode?: string }>
        originalKill: (sessionId: string) => Promise<boolean>
        originalCreate: (...args: unknown[]) => Promise<{ success: boolean; error?: string }>
      }

      const globalWindow = window as unknown as { __ptySpyState?: SpyState }
      const api = window.api as unknown as {
        pty: {
          kill: (sessionId: string) => Promise<boolean>
          create: (...args: unknown[]) => Promise<{ success: boolean; error?: string }>
        }
      }

      globalWindow.__ptySpyState = {
        kills: [],
        creates: [],
        originalKill: api.pty.kill,
        originalCreate: api.pty.create,
      }

      api.pty.kill = async (id: string) => {
        globalWindow.__ptySpyState?.kills.push(id)
        return globalWindow.__ptySpyState!.originalKill(id)
      }

      api.pty.create = async (...args: unknown[]) => {
        globalWindow.__ptySpyState?.creates.push({
          sessionId: String(args[0]),
          mode: typeof args[4] === 'string' ? args[4] : undefined,
        })
        return globalWindow.__ptySpyState!.originalCreate(...args)
      }
    })

    try {
      await switchTerminalMode(mainWindow, 'codex')

      const spyState = await mainWindow.evaluate(() => {
        const globalWindow = window as unknown as {
          __ptySpyState?: { kills: string[]; creates: Array<{ sessionId: string; mode?: string }> }
        }
        return globalWindow.__ptySpyState ?? { kills: [], creates: [] }
      })

      expect(spyState.kills).toContain(sessionId)
      expect(
        spyState.creates.some((call) => call.sessionId === sessionId && call.mode === 'codex')
      ).toBe(true)

      const task = await mainWindow.evaluate((id) => window.api.db.getTask(id), taskId)
      expect(task?.terminal_mode).toBe('codex')

      await switchTerminalMode(mainWindow, 'terminal')
      await waitForPtySession(mainWindow, sessionId)
    } finally {
      await mainWindow.evaluate(() => {
        const globalWindow = window as unknown as {
          __ptySpyState?: {
            originalKill: (sessionId: string) => Promise<boolean>
            originalCreate: (...args: unknown[]) => Promise<{ success: boolean; error?: string }>
          }
        }
        if (!globalWindow.__ptySpyState) return

        const api = window.api as unknown as {
          pty: {
            kill: (sessionId: string) => Promise<boolean>
            create: (...args: unknown[]) => Promise<{ success: boolean; error?: string }>
          }
        }

        api.pty.kill = globalWindow.__ptySpyState.originalKill
        api.pty.create = globalWindow.__ptySpyState.originalCreate
        delete globalWindow.__ptySpyState
      })
    }
  })
})
