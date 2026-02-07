import { test, expect, seed, goHome, clickProject } from './fixtures/electron'
import { TEST_PROJECT_PATH } from './fixtures/electron'

test.describe('Codex resume', () => {
  let projectAbbrev: string
  let taskId: string
  const codexConversationId = '11111111-2222-4333-8444-555555555555'

  test.beforeAll(async ({ mainWindow, electronApp }) => {
    await electronApp.evaluate(({ ipcMain }) => {
      type CreateCall = {
        sessionId: string
        mode?: string
        conversationId?: string | null
        existingConversationId?: string | null
      }
      ;(globalThis as unknown as { __ptyCreateCalls?: CreateCall[] }).__ptyCreateCalls = []

      ipcMain.removeHandler('pty:create')
      ipcMain.handle(
        'pty:create',
        (
          _event,
          sessionId: string,
          _cwd: string,
          conversationId?: string | null,
          existingConversationId?: string | null,
          mode?: string
        ) => {
          ;(globalThis as unknown as { __ptyCreateCalls?: CreateCall[] }).__ptyCreateCalls?.push({
            sessionId,
            mode,
            conversationId,
            existingConversationId
          })
          return { success: true }
        }
      )
    })

    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'Codex Resume', color: '#22c55e', path: TEST_PROJECT_PATH })
    projectAbbrev = p.name.slice(0, 2).toUpperCase()

    const t = await s.createTask({ projectId: p.id, title: 'Codex resume task', status: 'todo' })
    taskId = t.id

    await mainWindow.evaluate(({ id, conversationId }) => {
      return window.api.db.updateTask({
        id,
        terminalMode: 'codex',
        codexConversationId: conversationId
      })
    }, { id: taskId, conversationId: codexConversationId })

    await s.refreshData()
    await goHome(mainWindow)
    await clickProject(mainWindow, projectAbbrev)
    await mainWindow.waitForTimeout(500)
    await mainWindow.getByText('Codex resume task').first().click()
    await mainWindow.waitForTimeout(700)
  })

  test('passes codex conversation ID as existingConversationId when creating PTY', async ({ electronApp }) => {
    await expect.poll(async () => {
      return electronApp.evaluate(() => {
        const calls = (globalThis as unknown as { __ptyCreateCalls?: Array<{ mode?: string; existingConversationId?: string | null }> }).__ptyCreateCalls ?? []
        return calls.length
      })
    }, { timeout: 10_000 }).toBeGreaterThan(0)

    const latestCreateCall = await electronApp.evaluate(() => {
      const calls = (globalThis as unknown as { __ptyCreateCalls?: Array<{ mode?: string; existingConversationId?: string | null }> }).__ptyCreateCalls ?? []
      return calls[calls.length - 1] ?? null
    })

    expect(latestCreateCall?.mode).toBe('codex')
    expect(latestCreateCall?.existingConversationId).toBe(codexConversationId)
  })
})
