import { test, expect, seed, goHome, clickProject } from './fixtures/electron'
import { TEST_PROJECT_PATH } from './fixtures/electron'

test.describe('Create task dialog & metadata editing', () => {
  let projectAbbrev: string

  test.beforeAll(async ({ mainWindow }) => {
    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'Dialog Test', color: '#3b82f6', path: TEST_PROJECT_PATH })
    projectAbbrev = p.name.slice(0, 2).toUpperCase()
    await s.refreshData()
    await goHome(mainWindow)
    await clickProject(mainWindow, projectAbbrev)
    await mainWindow.waitForTimeout(500)
  })

  test('Cmd+N opens create task dialog', async ({ mainWindow }) => {
    await mainWindow.keyboard.press('Meta+n')
    await expect(mainWindow.getByText('Create Task')).toBeVisible({ timeout: 3_000 })
  })

  test('fill and submit create task form', async ({ mainWindow }) => {
    // Title
    const titleInput = mainWindow.locator('input[name="title"]')
    await titleInput.fill('Dialog created task')

    // Status — Radix Select, click trigger then item
    const statusTrigger = mainWindow.locator('form').getByRole('combobox').first()
    await statusTrigger.click()
    await mainWindow.getByRole('option', { name: 'In Progress' }).click()
    await mainWindow.waitForTimeout(200)

    // Priority — second Radix Select
    const priorityTrigger = mainWindow.locator('form').getByRole('combobox').nth(1)
    await priorityTrigger.click()
    await mainWindow.getByRole('option', { name: 'P1 - Urgent' }).click()
    await mainWindow.waitForTimeout(200)

    // Submit
    await mainWindow.getByRole('button', { name: 'Create' }).click()
    await mainWindow.waitForTimeout(500)

    // Close dialog
    await mainWindow.keyboard.press('Escape')
    await mainWindow.waitForTimeout(300)
  })

  test('created task appears on kanban', async ({ mainWindow }) => {
    await goHome(mainWindow)
    await clickProject(mainWindow, projectAbbrev)
    await mainWindow.waitForTimeout(500)
    await expect(mainWindow.getByText('Dialog created task')).toBeVisible({ timeout: 5_000 })
  })

  test('change status in task detail metadata sidebar', async ({ mainWindow }) => {
    // Open task detail
    await mainWindow.getByText('Dialog created task').first().click()
    await mainWindow.waitForTimeout(500)

    // Find status select in sidebar (labeled "Status")
    const statusLabel = mainWindow.getByText('Status', { exact: true }).locator('..')
    const statusTrigger = statusLabel.getByRole('combobox')
    await statusTrigger.click()
    await mainWindow.getByRole('option', { name: 'Review' }).click()
    await mainWindow.waitForTimeout(300)

    // Verify persisted via API
    const tasks = await seed(mainWindow).getTasks()
    const task = tasks.find((t: { title: string }) => t.title === 'Dialog created task')
    expect(task?.status).toBe('review')
  })

  test('change priority in task detail metadata sidebar', async ({ mainWindow }) => {
    const priorityLabel = mainWindow.getByText('Priority', { exact: true }).locator('..')
    const priorityTrigger = priorityLabel.getByRole('combobox')
    await priorityTrigger.click()
    await mainWindow.getByRole('option', { name: 'P4 - Low' }).click()
    await mainWindow.waitForTimeout(300)

    const tasks = await seed(mainWindow).getTasks()
    const task = tasks.find((t: { title: string }) => t.title === 'Dialog created task')
    expect(task?.priority).toBe(4)
  })

  test('go back to kanban after metadata edits', async ({ mainWindow }) => {
    await goHome(mainWindow)
    await mainWindow.waitForTimeout(300)
    await clickProject(mainWindow, projectAbbrev)
    await mainWindow.waitForTimeout(300)
    await expect(mainWindow.locator('h3').getByText('Inbox', { exact: true })).toBeVisible({ timeout: 5_000 })
  })
})
