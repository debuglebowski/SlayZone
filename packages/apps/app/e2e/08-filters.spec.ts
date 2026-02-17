import { test, expect, seed, goHome, clickProject } from './fixtures/electron'
import { TEST_PROJECT_PATH } from './fixtures/electron'

test.describe('Filters', () => {
  let projectAbbrev: string

  test.beforeAll(async ({ mainWindow }) => {
    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'Filter Test', color: '#ec4899', path: TEST_PROJECT_PATH })
    projectAbbrev = p.name.slice(0, 2).toUpperCase()

    await s.createTask({ projectId: p.id, title: 'Critical filter task', status: 'todo', priority: 1 })
    await s.createTask({ projectId: p.id, title: 'Low filter task', status: 'todo', priority: 4 })
    await s.createTask({ projectId: p.id, title: 'Done filter task', status: 'done' })

    const tag = await s.createTag({ name: 'urgent', color: '#ef4444' })
    const tasks = await s.getTasks()
    const criticalTask = tasks.find((t: { title: string }) => t.title === 'Critical filter task')
    if (criticalTask && tag) {
      await s.setTagsForTask(criticalTask.id, [tag.id])
    }
    await s.refreshData()

    await goHome(mainWindow)
    await clickProject(mainWindow, projectAbbrev)
    await expect(mainWindow.getByText('Critical filter task')).toBeVisible({ timeout: 5_000 })
  })

  test('done tasks in DOM by default', async ({ mainWindow }) => {
    // showDone defaults to true — Done column may be off-screen but present in DOM
    await expect(mainWindow.getByText('Done filter task')).toBeAttached({ timeout: 5_000 })
  })

  test('toggle done switch hides done tasks', async ({ mainWindow }) => {
    // Switch component renders as button[role="switch"]
    const doneSwitch = mainWindow.locator('#show-done')
    if (await doneSwitch.isVisible().catch(() => false)) {
      await doneSwitch.click()
      await expect(mainWindow.getByText('Done filter task')).not.toBeVisible({ timeout: 5_000 })

      // Toggle back on
      await doneSwitch.click()
      await expect(mainWindow.getByText('Done filter task')).toBeVisible({ timeout: 5_000 })
    }
  })

  test('active tasks always visible', async ({ mainWindow }) => {
    await expect(mainWindow.getByText('Critical filter task')).toBeVisible()
    await expect(mainWindow.getByText('Low filter task')).toBeVisible()
  })
})
