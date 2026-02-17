import { test, expect, seed, goHome, clickProject } from './fixtures/electron'
import { TEST_PROJECT_PATH } from './fixtures/electron'

test.describe('Tag management', () => {
  let projectAbbrev: string

  const settingsDialog = (mainWindow: import('@playwright/test').Page) =>
    mainWindow.getByRole('dialog').last()

  const openSettingsDialog = async (mainWindow: import('@playwright/test').Page) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const dialog = settingsDialog(mainWindow)
      if (await dialog.isVisible({ timeout: 500 }).catch(() => false)) {
        return
      }

      const settingsButton = mainWindow
        .locator('[data-slot="sidebar"] [data-sidebar="footer"] button')
        .filter({ has: mainWindow.locator('.lucide-settings') })
        .first()

      await expect(settingsButton).toBeVisible({ timeout: 5_000 })
      await settingsButton.click()

      if (await dialog.isVisible({ timeout: 2_000 }).catch(() => false)) {
        return
      }
    }
    await expect(settingsDialog(mainWindow)).toBeVisible({ timeout: 5_000 })
  }

  const openTagsSection = async (mainWindow: import('@playwright/test').Page) => {
    await openSettingsDialog(mainWindow)
    const dialog = settingsDialog(mainWindow)
    await dialog.locator('aside button').filter({ hasText: 'Tags' }).first().click()
    await expect(dialog.locator('#new-tag')).toBeVisible({ timeout: 5_000 })
  }

  test.beforeAll(async ({ mainWindow }) => {
    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'Tag Test', color: '#3b82f6', path: TEST_PROJECT_PATH })
    projectAbbrev = p.name.slice(0, 2).toUpperCase()
    await s.createTask({ projectId: p.id, title: 'Tag test task', status: 'todo' })
    await s.refreshData()
  })

  test('create tag in settings dialog', async ({ mainWindow }) => {
    await openTagsSection(mainWindow)

    // Fill tag name
    const tagInput = settingsDialog(mainWindow).locator('#new-tag')
    await tagInput.fill('e2e-tag')
    await settingsDialog(mainWindow).getByRole('button', { name: 'Add' }).click()

    // Verify tag appears in list
    await expect(settingsDialog(mainWindow).getByText('e2e-tag')).toBeVisible({ timeout: 3_000 })
  })

  test('create second tag', async ({ mainWindow }) => {
    const tagInput = settingsDialog(mainWindow).locator('#new-tag')
    await tagInput.fill('e2e-tag-2')
    await settingsDialog(mainWindow).getByRole('button', { name: 'Add' }).click()
    await expect(settingsDialog(mainWindow).getByText('e2e-tag-2')).toBeVisible({ timeout: 3_000 })

    // Close settings
    await mainWindow.keyboard.press('Escape')
    await expect(settingsDialog(mainWindow)).not.toBeVisible({ timeout: 3_000 })
  })

  test('assign tag to task via API', async ({ mainWindow }) => {
    const s = seed(mainWindow)
    const tasks = await s.getTasks()
    const task = tasks.find((t: { title: string }) => t.title === 'Tag test task')
    const tags = await s.getTags()
    const tag = tags.find((t: { name: string }) => t.name === 'e2e-tag')

    if (task && tag) {
      await s.setTagsForTask(task.id, [tag.id])
    }
    await s.refreshData()

    // Verify tag assigned
    const assignedTags = await mainWindow.evaluate(
      (taskId) => window.api.taskTags.getTagsForTask(taskId),
      task!.id
    )
    expect(assignedTags.length).toBeGreaterThan(0)
  })

  test('tag pills visible in filter popover', async ({ mainWindow }) => {
    await goHome(mainWindow)
    await clickProject(mainWindow, projectAbbrev)

    // Open the Filter popover (ListFilter icon)
    const filterBtn = mainWindow.locator('button').filter({ has: mainWindow.locator('.lucide-list-filter') }).first()
    await expect(filterBtn).toBeVisible({ timeout: 5_000 })
    await filterBtn.click()

    // Tags section with individual tag pill buttons
    await expect(mainWindow.getByText('Tags', { exact: true })).toBeVisible({ timeout: 5_000 })
    await expect(mainWindow.locator('button').filter({ hasText: 'e2e-tag' }).first()).toBeVisible()

    // Close popover
    await mainWindow.keyboard.press('Escape')
  })

  test('delete tag', async ({ mainWindow }) => {
    const s = seed(mainWindow)
    const tagsBefore = await s.getTags()
    const tag = tagsBefore.find((t: { name: string }) => t.name === 'e2e-tag-2')
    expect(tag).toBeTruthy()

    await s.deleteTag(tag!.id)

    await expect
      .poll(async () => {
        const tagsAfter = await s.getTags()
        return tagsAfter.some((t: { name: string }) => t.name === 'e2e-tag-2')
      }, { timeout: 3_000 })
      .toBe(false)
  })
})
