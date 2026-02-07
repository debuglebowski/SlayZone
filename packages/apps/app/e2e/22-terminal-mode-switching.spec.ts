import { test, expect, seed, goHome, clickProject } from './fixtures/electron'
import { TEST_PROJECT_PATH } from './fixtures/electron'
import { openTaskTerminal } from './fixtures/terminal'

test.describe('Terminal mode switching', () => {
  let projectAbbrev: string
  let taskId: string

  test.beforeAll(async ({ mainWindow }) => {
    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'Mode Switch', color: '#8b5cf6', path: TEST_PROJECT_PATH })
    projectAbbrev = p.name.slice(0, 2).toUpperCase()
    const t = await s.createTask({ projectId: p.id, title: 'Mode switch task', status: 'todo' })
    taskId = t.id
    await s.refreshData()

    await openTaskTerminal(mainWindow, { projectAbbrev, taskTitle: 'Mode switch task' })
  })

  /** Find the terminal mode select trigger in the bottom bar */
  const modeTrigger = (page: import('@playwright/test').Page) =>
    page.getByTestId('terminal-mode-trigger')

  test('default mode is Claude Code', async ({ mainWindow }) => {
    await expect(modeTrigger(mainWindow)).toHaveText(/Claude Code/)
  })

  test('claude-code mode shows Sync name button and Flags input', async ({ mainWindow }) => {
    await expect(mainWindow.getByRole('button', { name: 'Sync name' })).toBeVisible()
    await expect(mainWindow.locator('input[placeholder="Flags"]')).toBeVisible()
  })

  test('switch to Terminal mode', async ({ mainWindow }) => {
    await modeTrigger(mainWindow).click()
    await mainWindow.getByRole('option', { name: 'Terminal' }).click()

    // Select now shows Terminal
    await expect(modeTrigger(mainWindow)).toHaveText(/Terminal/)
  })

  test('terminal mode hides Sync name and Flags', async ({ mainWindow }) => {
    await expect(mainWindow.getByRole('button', { name: 'Sync name' })).not.toBeVisible()
    await expect(mainWindow.locator('input[placeholder="Flags"]')).not.toBeVisible()
  })

  test('mode persists in DB', async ({ mainWindow }) => {
    const task = await mainWindow.evaluate((id) => window.api.db.getTask(id), taskId)
    expect(task?.terminal_mode).toBe('terminal')
  })

  test('switch to Codex mode', async ({ mainWindow }) => {
    await modeTrigger(mainWindow).click()
    await mainWindow.getByRole('option', { name: 'Codex' }).click()

    await expect(modeTrigger(mainWindow)).toHaveText(/Codex/)
  })

  test('codex mode shows Flags but hides Sync name', async ({ mainWindow }) => {
    await expect(mainWindow.locator('input[placeholder="Flags"]')).toBeVisible()
    await expect(mainWindow.getByRole('button', { name: 'Sync name' })).not.toBeVisible()
  })

  test('mode persists across navigation', async ({ mainWindow }) => {
    // Navigate away
    await goHome(mainWindow)

    // Navigate back
    await clickProject(mainWindow, projectAbbrev)
    await mainWindow.getByText('Mode switch task').first().click()
    await expect(modeTrigger(mainWindow)).toBeVisible()

    // Still Codex
    await expect(modeTrigger(mainWindow)).toHaveText(/Codex/)
  })

  test('switch back to Claude Code', async ({ mainWindow }) => {
    await modeTrigger(mainWindow).click()
    await mainWindow.getByRole('option', { name: 'Claude Code' }).click()

    await expect(modeTrigger(mainWindow)).toHaveText(/Claude Code/)
    await expect(mainWindow.getByRole('button', { name: 'Sync name' })).toBeVisible()
    await expect(mainWindow.locator('input[placeholder="Flags"]')).toBeVisible()
  })

  test('conversation IDs cleared on mode switch', async ({ mainWindow }) => {
    // Set a fake conversation ID
    await mainWindow.evaluate((id) =>
      window.api.db.updateTask({ id, claudeConversationId: 'fake-convo-123' }), taskId)

    // Switch to terminal and back
    await modeTrigger(mainWindow).click()
    await mainWindow.getByRole('option', { name: 'Terminal' }).click()
    await expect(modeTrigger(mainWindow)).toHaveText(/Terminal/)

    // Verify cleared
    const task = await mainWindow.evaluate((id) => window.api.db.getTask(id), taskId)
    expect(task?.claude_conversation_id).toBeNull()
    expect(task?.codex_conversation_id).toBeNull()

    // Switch back to claude-code for clean state
    await modeTrigger(mainWindow).click()
    await mainWindow.getByRole('option', { name: 'Claude Code' }).click()
    await expect(modeTrigger(mainWindow)).toHaveText(/Claude Code/)
  })
})
