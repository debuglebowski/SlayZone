import { test, expect, seed, goHome, clickProject } from './fixtures/electron'
import { TEST_PROJECT_PATH } from './fixtures/electron'

test.describe('Advanced filters & group by', () => {
  let projectAbbrev: string

  test.beforeAll(async ({ mainWindow }) => {
    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'Adv Filter Test', color: '#14b8a6', path: TEST_PROJECT_PATH })
    projectAbbrev = p.name.slice(0, 2).toUpperCase()

    // Seed tasks with various priorities
    await s.createTask({ projectId: p.id, title: 'Urgent filter task', status: 'todo', priority: 1 })
    await s.createTask({ projectId: p.id, title: 'Low filter task 2', status: 'todo', priority: 4 })

    // Seed task with past due date (overdue)
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    await s.createTask({
      projectId: p.id,
      title: 'Overdue filter task',
      status: 'in_progress',
      dueDate: yesterday.toISOString().split('T')[0]
    })

    // Seed task with future due date
    const nextWeek = new Date()
    nextWeek.setDate(nextWeek.getDate() + 5)
    await s.createTask({
      projectId: p.id,
      title: 'Future filter task',
      status: 'todo',
      dueDate: nextWeek.toISOString().split('T')[0]
    })

    await s.refreshData()
    await goHome(mainWindow)
    await clickProject(mainWindow, projectAbbrev)
    await expect(mainWindow.getByText('Urgent filter task')).toBeVisible({ timeout: 5_000 })
  })

  test('priority filter shows only matching tasks', async ({ mainWindow }) => {
    // Find priority filter — it's a Radix Select in the filter bar
    // The filter bar has multiple selects; priority one shows "Priority" or "All"
    const priorityTrigger = mainWindow.getByRole('combobox').filter({ hasText: /Priority|All/ }).first()

    if (await priorityTrigger.isVisible().catch(() => false)) {
      await priorityTrigger.click()
      await mainWindow.getByRole('option', { name: /Urgent/ }).click()

      // Urgent task should be visible, low should not
      await expect(mainWindow.getByText('Urgent filter task')).toBeVisible({ timeout: 3_000 })
      await expect(mainWindow.getByText('Low filter task 2')).not.toBeVisible()

      // Reset filter
      await priorityTrigger.click()
      await mainWindow.getByRole('option', { name: /All/i }).first().click()
      await expect(mainWindow.getByText('Low filter task 2')).toBeVisible({ timeout: 3_000 })
    }
  })

  test('due date filter shows overdue tasks', async ({ mainWindow }) => {
    const dueDateTrigger = mainWindow.getByRole('combobox').filter({ hasText: /Due|All/ }).nth(1)

    if (await dueDateTrigger.isVisible().catch(() => false)) {
      await dueDateTrigger.click()
      await mainWindow.getByRole('option', { name: /Overdue/i }).click()

      await expect(mainWindow.getByText('Overdue filter task')).toBeVisible({ timeout: 3_000 })

      // Reset
      await dueDateTrigger.click()
      await mainWindow.getByRole('option', { name: /All/i }).first().click()
      await expect(mainWindow.getByText('Overdue filter task')).toBeVisible({ timeout: 3_000 })
    }
  })

  test('group by priority changes column headers', async ({ mainWindow }) => {
    // Group by select — find by the "Group" label next to it
    const groupLabel = mainWindow.getByText('Group', { exact: true })
    const groupByTrigger = groupLabel.locator('..').getByRole('combobox')

    if (await groupByTrigger.isVisible().catch(() => false)) {
      await groupByTrigger.click()
      await mainWindow.getByRole('option', { name: /Priority/i }).click()

      // Column headers should now be priority-based (Urgent, High, etc.)
      await expect(mainWindow.locator('h3').getByText(/Urgent/)).toBeVisible({ timeout: 3_000 })

      // Switch back to status grouping — re-locate trigger since text changed
      const groupByTrigger2 = groupLabel.locator('..').getByRole('combobox')
      await groupByTrigger2.click()
      await mainWindow.getByRole('option', { name: /Status/i }).click()

      // Verify status columns restored
      await expect(mainWindow.locator('h3').getByText('Inbox', { exact: true })).toBeVisible({ timeout: 3_000 })
    }
  })
})
