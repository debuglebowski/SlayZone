import { test, expect, seed, goHome, clickProject } from './fixtures/electron'
import { TEST_PROJECT_PATH } from './fixtures/electron'

test.describe('Task CRUD', () => {
  let projectAbbrev: string

  test.beforeAll(async ({ mainWindow }) => {
    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'CRUD Test', color: '#3b82f6', path: TEST_PROJECT_PATH })
    projectAbbrev = p.name.slice(0, 2).toUpperCase()
    await s.refreshData()
    await goHome(mainWindow)
    await clickProject(mainWindow, projectAbbrev)
  })

  test('create task via API and verify on kanban', async ({ mainWindow }) => {
    const s = seed(mainWindow)
    const projects = await s.getProjects()
    const p = projects.find((pr: { name: string }) => pr.name === 'CRUD Test')!
    await s.createTask({ projectId: p.id, title: 'My first task', status: 'in_progress' })
    await s.refreshData()

    await expect(mainWindow.getByText('My first task')).toBeVisible({ timeout: 10_000 })
  })

  test('create task with priority in correct column', async ({ mainWindow }) => {
    const s = seed(mainWindow)
    const projects = await s.getProjects()
    const p = projects.find((pr: { name: string }) => pr.name === 'CRUD Test')!
    await s.createTask({
      projectId: p.id,
      title: 'High priority task',
      status: 'in_progress',
      priority: 1,
    })
    await s.refreshData()

    await expect(mainWindow.getByText('High priority task')).toBeVisible({ timeout: 5_000 })
    const inProgressHeader = mainWindow.locator('h3').getByText('In Progress', { exact: true })
    await expect(inProgressHeader).toBeVisible()
  })

  test('archive task via API and verify hidden', async ({ mainWindow }) => {
    const s = seed(mainWindow)
    const tasks = await s.getTasks()
    const task = tasks.find((t: { title: string }) => t.title === 'My first task')
    if (task) {
      await s.archiveTask(task.id)
    }
    await s.refreshData()

    await expect(mainWindow.getByText('My first task')).not.toBeVisible({ timeout: 5_000 })
  })

  test('delete task', async ({ mainWindow }) => {
    const s = seed(mainWindow)
    const projects = await s.getProjects()
    const p = projects.find((pr: { name: string }) => pr.name === 'CRUD Test')!
    const task = await s.createTask({ projectId: p.id, title: 'Task to delete' })
    await s.refreshData()

    await expect(mainWindow.getByText('Task to delete')).toBeVisible({ timeout: 5_000 })

    await s.deleteTask(task.id)
    await s.refreshData()

    await expect(mainWindow.getByText('Task to delete')).not.toBeVisible({ timeout: 5_000 })
  })
})
