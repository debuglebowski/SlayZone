import { test, expect, seed, goHome, clickProject, clickAll } from './fixtures/electron'
import { TEST_PROJECT_PATH } from './fixtures/electron'

test.describe('Multi-project & persistence', () => {
  test.beforeAll(async ({ mainWindow }) => {
    const s = seed(mainWindow)

    // Create two distinct projects with tasks
    let projects = await s.getProjects()
    const hasAlpha = projects.some((p: { name: string }) => p.name === 'Alpha Project')
    const hasBeta = projects.some((p: { name: string }) => p.name === 'Beta Project')

    if (!hasAlpha) {
      const alpha = await s.createProject({ name: 'Alpha Project', color: '#ef4444', path: TEST_PROJECT_PATH })
      await s.createTask({ projectId: alpha.id, title: 'Alpha task one', status: 'todo' })
      await s.createTask({ projectId: alpha.id, title: 'Alpha task two', status: 'in_progress' })
    }
    if (!hasBeta) {
      const beta = await s.createProject({ name: 'Beta Project', color: '#3b82f6', path: TEST_PROJECT_PATH })
      await s.createTask({ projectId: beta.id, title: 'Beta task one', status: 'todo' })
      await s.createTask({ projectId: beta.id, title: 'Beta task two', status: 'done' })
    }
    await s.refreshData()
    await goHome(mainWindow)
    await mainWindow.waitForTimeout(500)
  })

  test('switching projects shows correct tasks', async ({ mainWindow }) => {
    // Select Alpha
    await clickProject(mainWindow, 'AL')
    await mainWindow.waitForTimeout(500)

    await expect(mainWindow.getByText('Alpha task one')).toBeVisible({ timeout: 5_000 })
    await expect(mainWindow.getByText('Beta task one')).not.toBeVisible()

    // Switch to Beta
    await clickProject(mainWindow, 'BE')
    await mainWindow.waitForTimeout(500)

    await expect(mainWindow.getByText('Beta task one')).toBeVisible({ timeout: 5_000 })
    await expect(mainWindow.getByText('Alpha task one')).not.toBeVisible()
  })

  test('All view shows tasks from both projects', async ({ mainWindow }) => {
    await clickAll(mainWindow)
    await mainWindow.waitForTimeout(500)

    await expect(mainWindow.getByText('Alpha task one')).toBeAttached({ timeout: 5_000 })
    await expect(mainWindow.getByText('Beta task one')).toBeAttached()
  })

  test('search finds tasks across projects', async ({ mainWindow }) => {
    await mainWindow.keyboard.press('Meta+k')
    await mainWindow.waitForTimeout(300)

    const searchInput = mainWindow.getByPlaceholder('Search tasks and projects...')
    await searchInput.fill('Beta task')
    await mainWindow.waitForTimeout(500)

    // Should find Beta task even if currently viewing Alpha
    await expect(mainWindow.getByLabel('Tasks').getByText('Beta task one')).toBeVisible({ timeout: 3_000 })

    await mainWindow.keyboard.press('Escape')
  })

  test('search with no matching results', async ({ mainWindow }) => {
    await mainWindow.keyboard.press('Meta+k')
    await mainWindow.waitForTimeout(300)

    const searchInput = mainWindow.getByPlaceholder('Search tasks and projects...')
    await searchInput.fill('xyznonexistent999')
    await mainWindow.waitForTimeout(500)

    // No results — the tasks/projects groups should not show matching items
    await expect(mainWindow.getByLabel('Tasks').getByText('xyznonexistent999')).not.toBeVisible()

    await mainWindow.keyboard.press('Escape')
  })

  test('empty kanban columns still render headers', async ({ mainWindow }) => {
    await clickProject(mainWindow, 'AL')
    await mainWindow.waitForTimeout(500)

    // Alpha has tasks in todo and in_progress, but other columns should still have headers
    // Check that Inbox header exists (it should be rendered even if empty)
    await expect(mainWindow.locator('h3').getByText('Inbox', { exact: true })).toBeAttached({ timeout: 5_000 })
  })

  test('theme setting persists after refresh', async ({ mainWindow }) => {
    const s = seed(mainWindow)

    // Set dark theme via API
    await s.setTheme('dark')
    await mainWindow.waitForTimeout(300)

    const isDark = await mainWindow.evaluate(() =>
      document.documentElement.classList.contains('dark')
    )
    expect(isDark).toBe(true)

    // Refresh data (simulates re-render)
    await s.refreshData()
    await mainWindow.waitForTimeout(300)

    const stillDark = await mainWindow.evaluate(() =>
      document.documentElement.classList.contains('dark')
    )
    expect(stillDark).toBe(true)

    // Restore light theme
    await s.setTheme('light')
    await mainWindow.waitForTimeout(300)
  })
})
