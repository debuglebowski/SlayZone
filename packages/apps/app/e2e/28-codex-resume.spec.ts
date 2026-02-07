import { test, expect, seed } from './fixtures/electron'
import { TEST_PROJECT_PATH } from './fixtures/electron'
import { openTaskTerminal } from './fixtures/terminal'

test.describe('Codex resume', () => {
  let projectAbbrev: string
  let taskId: string
  let mainSessionId: string
  const codexConversationId = '11111111-2222-4333-8444-555555555555'

  test.beforeAll(async ({ mainWindow }) => {
    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'Codex Resume', color: '#22c55e', path: TEST_PROJECT_PATH })
    projectAbbrev = p.name.slice(0, 2).toUpperCase()

    const t = await s.createTask({ projectId: p.id, title: 'Codex resume task', status: 'todo' })
    taskId = t.id
    mainSessionId = `${taskId}:${taskId}`

    await mainWindow.evaluate(
      ({ id, conversationId }) => {
        return window.api.db.updateTask({
          id,
          terminalMode: 'codex',
          codexConversationId: conversationId,
        })
      },
      { id: taskId, conversationId: codexConversationId }
    )

    await mainWindow.evaluate(() => {
      type CreateCall = {
        sessionId: string
        mode?: string
        conversationId?: string | null
        existingConversationId?: string | null
      }

      const globalWindow = window as unknown as {
        __ptyCreateCalls?: CreateCall[]
        __originalPtyCreate?: (...args: unknown[]) => Promise<{ success: boolean; error?: string }>
      }

      globalWindow.__ptyCreateCalls = []

      const api = window.api as unknown as {
        pty: { create: (...args: unknown[]) => Promise<{ success: boolean; error?: string }> }
      }

      globalWindow.__originalPtyCreate = api.pty.create
      api.pty.create = async (...args: unknown[]) => {
        globalWindow.__ptyCreateCalls?.push({
          sessionId: String(args[0]),
          mode: typeof args[4] === 'string' ? args[4] : undefined,
          conversationId: typeof args[2] === 'string' ? args[2] : undefined,
          existingConversationId: typeof args[3] === 'string' ? args[3] : undefined,
        })

        const originalCreate = globalWindow.__originalPtyCreate
        if (!originalCreate) {
          throw new Error('Missing original pty.create')
        }
        return originalCreate(...args)
      }
    })

    await s.refreshData()
    await openTaskTerminal(mainWindow, { projectAbbrev, taskTitle: 'Codex resume task' })
  })

  test.afterAll(async ({ mainWindow }) => {
    await mainWindow.evaluate(() => {
      const globalWindow = window as unknown as {
        __originalPtyCreate?: (...args: unknown[]) => Promise<{ success: boolean; error?: string }>
        __ptyCreateCalls?: Array<unknown>
      }

      if (globalWindow.__originalPtyCreate) {
        ;(
          window.api as unknown as {
            pty: { create: (...args: unknown[]) => Promise<{ success: boolean; error?: string }> }
          }
        ).pty.create = globalWindow.__originalPtyCreate
      }

      delete globalWindow.__originalPtyCreate
      delete globalWindow.__ptyCreateCalls
    })
  })

  test('passes codex conversation ID as existingConversationId when creating PTY', async ({ mainWindow }) => {
    await expect
      .poll(async () => {
        return mainWindow.evaluate((sessionId) => {
          type CreateCall = {
            sessionId: string
            mode?: string
            existingConversationId?: string | null
          }

          const calls =
            (window as unknown as { __ptyCreateCalls?: CreateCall[] }).__ptyCreateCalls ?? []
          return calls.find((call) => call.sessionId === sessionId) ?? null
        }, mainSessionId)
      })
      .not.toBeNull()

    const matchingCreateCall = await mainWindow.evaluate((sessionId) => {
      type CreateCall = {
        sessionId: string
        mode?: string
        existingConversationId?: string | null
      }

      const calls =
        (window as unknown as { __ptyCreateCalls?: CreateCall[] }).__ptyCreateCalls ?? []
      return calls.find((call) => call.sessionId === sessionId) ?? null
    }, mainSessionId)

    expect(matchingCreateCall).not.toBeNull()
    expect(matchingCreateCall?.mode).toBe('codex')
    expect(matchingCreateCall?.existingConversationId).toBe(codexConversationId)
  })
})
