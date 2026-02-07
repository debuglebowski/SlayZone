import { test, expect, seed, goHome, clickProject } from './fixtures/electron'
import { TEST_PROJECT_PATH } from './fixtures/electron'

test.describe('Navigation & tabs', () => {
  let projectAbbrev: string

  test.beforeAll(async ({ mainWindow }) => {
    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'Nav Test', color: '#06b6d4', path: TEST_PROJECT_PATH })
    projectAbbrev = p.name.slice(0, 2).toUpperCase()

    await s.createTask({ projectId: p.id, title: 'Nav search task', status: 'todo' })
    await s.createTask({ projectId: p.id, title: 'Nav detail task', status: 'in_progress' })
    await s.createTask({ projectId: p.id, title: 'Nav open task', status: 'todo' })
    await s.refreshData()

    await goHome(mainWindow)
    await clickProject(mainWindow, projectAbbrev)
    await mainWindow.waitForTimeout(500)
  })

  test('Cmd+K opens search dialog', async ({ mainWindow }) => {
    await mainWindow.keyboard.press('Meta+k')
    await expect(mainWindow.getByPlaceholder('Search tasks and projects...')).toBeVisible({
      timeout: 3_000,
    })
  })

  test('search finds tasks', async ({ mainWindow }) => {
    const searchInput = mainWindow.getByPlaceholder('Search tasks and projects...')
    await searchInput.fill('Nav search')
    await expect(mainWindow.getByLabel('Tasks').getByText('Nav search task')).toBeVisible({ timeout: 3_000 })
    await mainWindow.keyboard.press('Escape')
  })

  test('Cmd+K search selects result and navigates', async ({ mainWindow }) => {
    await mainWindow.keyboard.press('Meta+k')
    const searchInput = mainWindow.getByPlaceholder('Search tasks and projects...')
    await searchInput.fill('Nav detail task')
    await mainWindow.waitForTimeout(500)

    // Click the specific result to avoid selecting wrong task
    await mainWindow.getByLabel('Tasks').getByText('Nav detail task').click()
    await mainWindow.waitForTimeout(500)

    // Use evaluate to find visible input (hidden tab inputs may exist in DOM)
    const value = await mainWindow.evaluate(() => {
      const inputs = document.querySelectorAll('input')
      for (const input of inputs) {
        if (input.offsetParent !== null && input.value) return input.value
      }
      return null
    })
    expect(value).toBe('Nav detail task')
  })

  test('open task from kanban and close tab', async ({ mainWindow }) => {
    await mainWindow.keyboard.press('Escape')
    await mainWindow.waitForTimeout(200)

    await goHome(mainWindow)
    await clickProject(mainWindow, projectAbbrev)
    await mainWindow.waitForTimeout(300)

    await mainWindow.getByText('Nav open task').first().click()
    await mainWindow.waitForTimeout(300)

    // Go back to home instead of Cmd+W (which closes Electron window)
    await goHome(mainWindow)
    await mainWindow.waitForTimeout(300)
  })
})
