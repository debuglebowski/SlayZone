import { test, expect, seed, goHome, clickProject } from './fixtures/electron'
import { TEST_PROJECT_PATH } from './fixtures/electron'

test.describe('Kanban board', () => {
  let projectAbbrev: string

  test.beforeAll(async ({ mainWindow }) => {
    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'Board Test', color: '#8b5cf6', path: TEST_PROJECT_PATH })
    projectAbbrev = p.name.slice(0, 2).toUpperCase()

    await s.createTask({ projectId: p.id, title: 'Inbox task', status: 'inbox' })
    await s.createTask({ projectId: p.id, title: 'Backlog task', status: 'backlog' })
    await s.createTask({ projectId: p.id, title: 'Todo task', status: 'todo' })
    await s.createTask({ projectId: p.id, title: 'Review task', status: 'review' })
    await s.createTask({ projectId: p.id, title: 'Done task', status: 'done' })
    await s.refreshData()

    await goHome(mainWindow)
    await clickProject(mainWindow, projectAbbrev)
  })

  test('all status columns are visible', async ({ mainWindow }) => {
    for (const col of ['Inbox', 'Backlog', 'Todo', 'In Progress', 'Review']) {
      await expect(mainWindow.locator('h3').getByText(col, { exact: true })).toBeVisible()
    }
  })

  test('tasks appear in correct columns', async ({ mainWindow }) => {
    await expect(mainWindow.getByText('Inbox task')).toBeVisible()
    await expect(mainWindow.getByText('Backlog task')).toBeVisible()
    await expect(mainWindow.getByText('Todo task')).toBeVisible()
    await expect(mainWindow.getByText('Review task')).toBeVisible()
  })

  test('done tasks visible by default', async ({ mainWindow }) => {
    // showDone defaults to true
    await expect(mainWindow.getByText('Done task')).toBeVisible({ timeout: 5_000 })
  })
})
