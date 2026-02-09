import { test, expect, seed, goHome, clickProject } from './fixtures/electron'
import { TEST_PROJECT_PATH } from './fixtures/electron'

test.describe('Task detail actions', () => {
  let projectAbbrev: string

  test.beforeAll(async ({ mainWindow }) => {
    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'Actions Test', color: '#8b5cf6', path: TEST_PROJECT_PATH })
    projectAbbrev = p.name.slice(0, 2).toUpperCase()

    await s.createTask({ projectId: p.id, title: 'Archive me from detail', status: 'todo' })
    await s.createTask({ projectId: p.id, title: 'Delete me from detail', status: 'todo' })
    await s.createTask({ projectId: p.id, title: 'Complete me task', status: 'in_progress' })
    await s.refreshData()

    await goHome(mainWindow)
    await clickProject(mainWindow, projectAbbrev)
    await mainWindow.waitForTimeout(500)
  })

  test('archive task from detail dropdown', async ({ mainWindow }) => {
    await mainWindow.getByText('Archive me from detail').first().click()
    await mainWindow.waitForTimeout(500)

    // Open dropdown menu
    const moreButton = mainWindow.locator('.lucide-ellipsis:visible, .lucide-more-horizontal:visible').first()
    await moreButton.click()
    await mainWindow.waitForTimeout(300)

    // Click Archive — should update kanban state and close tab
    await mainWindow.getByRole('menuitem', { name: /Archive/ }).click()
    await mainWindow.waitForTimeout(500)

    // Kanban should no longer show archived task (state updated via onArchiveTask)
    await goHome(mainWindow)
    await clickProject(mainWindow, projectAbbrev)
    await mainWindow.waitForTimeout(500)

    await expect(mainWindow.getByText('Archive me from detail')).not.toBeVisible({ timeout: 3_000 })
  })

  test('delete task from detail dropdown', async ({ mainWindow }) => {
    await mainWindow.getByText('Delete me from detail').first().click()
    await mainWindow.waitForTimeout(500)

    const moreButton = mainWindow.locator('.lucide-ellipsis:visible, .lucide-more-horizontal:visible').first()
    await moreButton.click()
    await mainWindow.waitForTimeout(300)

    // Click Delete
    await mainWindow.getByRole('menuitem', { name: /Delete/ }).click()
    await mainWindow.waitForTimeout(300)

    // Confirm delete dialog
    const confirmBtn = mainWindow.getByRole('button', { name: /Delete/i }).last()
    if (await confirmBtn.isVisible().catch(() => false)) {
      await confirmBtn.click()
    }
    await mainWindow.waitForTimeout(500)

    // Kanban should no longer show deleted task (state updated via onDeleteTask)
    await goHome(mainWindow)
    await clickProject(mainWindow, projectAbbrev)
    await mainWindow.waitForTimeout(500)

    await expect(mainWindow.getByText('Delete me from detail')).not.toBeVisible({ timeout: 3_000 })
  })

  test('Cmd+Shift+D opens complete task confirmation', async ({ mainWindow }) => {
    await mainWindow.getByText('Complete me task').first().click()
    await expect(mainWindow.locator('[data-testid="terminal-mode-trigger"]:visible').first()).toBeVisible()

    await mainWindow.keyboard.press('Meta+Shift+d')

    await expect(mainWindow.getByText('Mark as done and close tab?')).toBeVisible({ timeout: 3_000 })
  })

  test('confirm complete task marks done and closes tab', async ({ mainWindow }) => {
    await mainWindow.getByRole('button', { name: 'Complete' }).click()

    await expect
      .poll(async () => {
        const tasks = await seed(mainWindow).getTasks()
        const task = tasks.find((t: { title: string }) => t.title === 'Complete me task')
        return task?.status ?? null
      }, { timeout: 5_000 })
      .toBe('done')
  })
})
