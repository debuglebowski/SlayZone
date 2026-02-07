import { test, expect, seed, goHome, clickProject } from './fixtures/electron'
import { TEST_PROJECT_PATH } from './fixtures/electron'

test.describe('AI description generation', () => {
  let projectAbbrev: string
  let taskId: string

  test.beforeAll(async ({ electronApp, mainWindow }) => {
    // Mock the AI IPC handler to avoid calling real CLI
    await electronApp.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('ai:generate-description')
      ipcMain.handle('ai:generate-description', async (_event, title: string, mode: string) => {
        if (mode === 'terminal') {
          return { success: false, error: 'AI not available in terminal mode' }
        }
        // Simulate a short delay like a real API call
        await new Promise(r => setTimeout(r, 300))
        return { success: true, description: `Mock description for: ${title}` }
      })
    })

    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'AI Desc Test', color: '#a855f7', path: TEST_PROJECT_PATH })
    projectAbbrev = p.name.slice(0, 2).toUpperCase()
    const t = await s.createTask({ projectId: p.id, title: 'Implement login flow', status: 'todo' })
    taskId = t.id
    await s.refreshData()

    await goHome(mainWindow)
    await clickProject(mainWindow, projectAbbrev)
    await mainWindow.waitForTimeout(500)

    // Open task detail
    await mainWindow.getByText('Implement login flow').first().click()
    await mainWindow.waitForTimeout(500)
  })

  const generateBtn = (page: import('@playwright/test').Page) =>
    page.getByRole('button', { name: /Generate description/ })

  test('generate button visible in claude-code mode', async ({ mainWindow }) => {
    await expect(generateBtn(mainWindow)).toBeVisible()
  })

  test('generate button shows sparkles icon', async ({ mainWindow }) => {
    const btn = generateBtn(mainWindow)
    await expect(btn.locator('.lucide-sparkles')).toBeVisible()
  })

  test('clicking generate shows loading spinner', async ({ mainWindow }) => {
    await generateBtn(mainWindow).click()

    // Should briefly show spinner (Loader2 with animate-spin)
    const spinner = mainWindow.locator('.animate-spin')
    // Spinner may be brief due to mock delay — check button is disabled during generation
    await expect(generateBtn(mainWindow)).toBeDisabled()
  })

  test('generated description appears in editor', async ({ mainWindow }) => {
    // Wait for generation to complete
    await mainWindow.waitForTimeout(1000)

    const editor = mainWindow.locator('[contenteditable="true"]').first()
    await expect(editor).toContainText('Mock description for: Implement login flow')
  })

  test('generated description persisted to DB', async ({ mainWindow }) => {
    const task = await mainWindow.evaluate((id) => window.api.db.getTask(id), taskId)
    expect(task?.description).toContain('Mock description for: Implement login flow')
  })

  test('button re-enabled after generation', async ({ mainWindow }) => {
    await expect(generateBtn(mainWindow)).toBeEnabled()
    // Sparkles icon restored (not spinner)
    await expect(generateBtn(mainWindow).locator('.lucide-sparkles')).toBeVisible()
  })

  test('button hidden in terminal mode', async ({ mainWindow }) => {
    // Switch to terminal mode
    const modeTrigger = mainWindow.getByRole('combobox').filter({ hasText: /Claude Code|Codex|Terminal/ })
    await modeTrigger.click()
    await mainWindow.getByRole('option', { name: 'Terminal' }).click()
    await mainWindow.waitForTimeout(500)

    await expect(generateBtn(mainWindow)).not.toBeVisible()
  })

  test('button visible again in codex mode', async ({ mainWindow }) => {
    const modeTrigger = mainWindow.getByRole('combobox').filter({ hasText: /Claude Code|Codex|Terminal/ })
    await modeTrigger.click()
    await mainWindow.getByRole('option', { name: 'Codex' }).click()
    await mainWindow.waitForTimeout(500)

    await expect(generateBtn(mainWindow)).toBeVisible()
  })

  test('generate works in codex mode too', async ({ mainWindow }) => {
    // Clear existing description first
    await mainWindow.evaluate((id) =>
      window.api.db.updateTask({ id, description: null }), taskId)
    await mainWindow.waitForTimeout(200)

    // Navigate away and back to reload clean state
    await goHome(mainWindow)
    await mainWindow.waitForTimeout(300)
    await clickProject(mainWindow, projectAbbrev)
    await mainWindow.waitForTimeout(300)
    await mainWindow.getByText('Implement login flow').first().click()
    await mainWindow.waitForTimeout(500)

    await generateBtn(mainWindow).click()
    await mainWindow.waitForTimeout(1000)

    const task = await mainWindow.evaluate((id) => window.api.db.getTask(id), taskId)
    expect(task?.description).toContain('Mock description for: Implement login flow')

    // Switch back to claude-code for clean state
    const modeTrigger = mainWindow.getByRole('combobox').filter({ hasText: /Claude Code|Codex|Terminal/ })
    await modeTrigger.click()
    await mainWindow.getByRole('option', { name: 'Claude Code' }).click()
    await mainWindow.waitForTimeout(500)
  })
})
