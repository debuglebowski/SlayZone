import { test, expect, seed, goHome, clickProject } from './fixtures/electron'
import { TEST_PROJECT_PATH } from './fixtures/electron'

test.describe('Task detail page', () => {
  let taskTitle = 'Detail test task'
  let projectAbbrev: string

  test.beforeAll(async ({ mainWindow }) => {
    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'Detail Test', color: '#f59e0b', path: TEST_PROJECT_PATH })
    projectAbbrev = p.name.slice(0, 2).toUpperCase()
    await s.createTask({ projectId: p.id, title: taskTitle, status: 'todo' })
    await s.refreshData()

    await goHome(mainWindow)
    await clickProject(mainWindow, projectAbbrev)
    await mainWindow.waitForTimeout(500)
  })

  test('click task card opens detail tab', async ({ mainWindow }) => {
    await mainWindow.getByText(taskTitle).first().click()
    await mainWindow.waitForTimeout(500)

    // Title input has no explicit type attr, so use plain input selector
    const titleInput = mainWindow.locator('input').first()
    await expect(titleInput).toHaveValue(taskTitle, { timeout: 5_000 })
  })

  test('edit title inline', async ({ mainWindow }) => {
    const titleInput = mainWindow.locator('input').first()
    await titleInput.click()
    await titleInput.fill('Updated detail title')
    await titleInput.press('Enter')

    await expect(titleInput).toHaveValue('Updated detail title')
    taskTitle = 'Updated detail title'
  })

  test('task detail page renders title correctly', async ({ mainWindow }) => {
    // Verify we're on the detail page with the correct title
    const titleInput = mainWindow.locator('input').first()
    await expect(titleInput).toHaveValue(taskTitle)
  })

  test('go back to kanban', async ({ mainWindow }) => {
    await goHome(mainWindow)
    await mainWindow.waitForTimeout(300)
    // Verify kanban is visible — check for any column header
    const inbox = mainWindow.locator('h3').getByText('Inbox', { exact: true })
    await inbox.scrollIntoViewIfNeeded({ timeout: 5_000 })
    await expect(inbox).toBeVisible({ timeout: 5_000 })
  })
})
