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
    page.locator('[data-testid="terminal-mode-trigger"]:visible').first()

  test('default mode is Claude Code', async ({ mainWindow }) => {
    await expect(modeTrigger(mainWindow)).toHaveText(/Claude Code/)
  })

  test('claude-code mode shows Sync name action', async ({ mainWindow }) => {
    await expect(mainWindow.getByRole('button', { name: 'Sync name' })).toBeVisible()
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

  test('codex mode hides Sync name', async ({ mainWindow }) => {
    await expect(mainWindow.getByRole('button', { name: 'Sync name' })).not.toBeVisible()
  })

  test('mode persists across navigation', async ({ mainWindow }) => {
    // Navigate away
    await goHome(mainWindow)

    // Navigate back
    await clickProject(mainWindow, projectAbbrev)
    await mainWindow.getByText('Mode switch task').first().click()
    await expect(modeTrigger(mainWindow)).toBeVisible()

    // Verify persisted mode from DB after re-open
    const task = await mainWindow.evaluate((id) => window.api.db.getTask(id), taskId)
    expect(task?.terminal_mode).toBe('codex')
  })

  test('switch back to Claude Code', async ({ mainWindow }) => {
    await modeTrigger(mainWindow).click()
    await mainWindow.getByRole('option', { name: 'Claude Code' }).click()

    await expect(modeTrigger(mainWindow)).toHaveText(/Claude Code/)
    await expect(mainWindow.getByRole('button', { name: 'Sync name' })).toBeVisible()
  })

  test('conversation IDs cleared on mode switch', async ({ mainWindow }) => {
    // Set fake conversation IDs for multiple providers
    await mainWindow.evaluate((id) =>
      window.api.db.updateTask({
        id,
        claudeConversationId: 'fake-convo-123',
        codexConversationId: 'fake-codex-456',
        cursorConversationId: 'fake-cursor-789',
        geminiConversationId: 'fake-gemini-abc',
        opencodeConversationId: 'fake-opencode-def',
      }), taskId)

    // Switch to terminal and back
    await modeTrigger(mainWindow).click()
    await mainWindow.getByRole('option', { name: 'Terminal' }).click()
    await expect(modeTrigger(mainWindow)).toHaveText(/Terminal/)

    // Verify ALL conversation IDs cleared
    const task = await mainWindow.evaluate((id) => window.api.db.getTask(id), taskId)
    expect(task?.claude_conversation_id).toBeNull()
    expect(task?.codex_conversation_id).toBeNull()
    expect(task?.cursor_conversation_id).toBeNull()
    expect(task?.gemini_conversation_id).toBeNull()
    expect(task?.opencode_conversation_id).toBeNull()

    // Switch back to claude-code for clean state
    await modeTrigger(mainWindow).click()
    await mainWindow.getByRole('option', { name: 'Claude Code' }).click()
    await expect(modeTrigger(mainWindow)).toHaveText(/Claude Code/)
  })

  test('flags persist through mode changes', async ({ mainWindow }) => {
    // Set custom flags for claude-code
    await mainWindow.evaluate((id) =>
      window.api.db.updateTask({ id, claudeFlags: '--custom-flag-test' }), taskId)

    // Switch to codex then back
    await modeTrigger(mainWindow).click()
    await mainWindow.getByRole('option', { name: 'Codex' }).click()
    await expect(modeTrigger(mainWindow)).toHaveText(/Codex/)

    await modeTrigger(mainWindow).click()
    await mainWindow.getByRole('option', { name: 'Claude Code' }).click()
    await expect(modeTrigger(mainWindow)).toHaveText(/Claude Code/)

    // Flags should persist (mode switch clears conversation IDs, not flags)
    const task = await mainWindow.evaluate((id) => window.api.db.getTask(id), taskId)
    expect(task?.claude_flags).toBe('--custom-flag-test')
  })
})
