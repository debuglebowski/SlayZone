import { test, expect, seed, goHome, clickProject, clickSettings } from './fixtures/electron'
import { TEST_PROJECT_PATH } from './fixtures/electron'

test.describe('Tag management', () => {
  let projectAbbrev: string

  test.beforeAll(async ({ mainWindow }) => {
    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'Tag Test', color: '#3b82f6', path: TEST_PROJECT_PATH })
    projectAbbrev = p.name.slice(0, 2).toUpperCase()
    await s.createTask({ projectId: p.id, title: 'Tag test task', status: 'todo' })
    await s.refreshData()
  })

  test('create tag in settings dialog', async ({ mainWindow }) => {
    await clickSettings(mainWindow)
    await expect(mainWindow.getByText('Appearance')).toBeVisible({ timeout: 5_000 })

    // Switch to Tags tab
    await mainWindow.getByRole('tab', { name: 'Tags' }).click()
    await mainWindow.waitForTimeout(300)

    // Fill tag name
    const tagInput = mainWindow.locator('#new-tag')
    await tagInput.fill('e2e-tag')
    await mainWindow.getByRole('button', { name: 'Add' }).click()
    await mainWindow.waitForTimeout(300)

    // Verify tag appears in list
    await expect(mainWindow.getByText('e2e-tag')).toBeVisible({ timeout: 3_000 })
  })

  test('create second tag', async ({ mainWindow }) => {
    const tagInput = mainWindow.locator('#new-tag')
    await tagInput.fill('e2e-tag-2')
    await mainWindow.getByRole('button', { name: 'Add' }).click()
    await mainWindow.waitForTimeout(300)
    await expect(mainWindow.getByText('e2e-tag-2')).toBeVisible({ timeout: 3_000 })

    // Close settings
    await mainWindow.keyboard.press('Escape')
    await mainWindow.waitForTimeout(300)
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

  test('tag filter button shows in filter bar', async ({ mainWindow }) => {
    await goHome(mainWindow)
    await clickProject(mainWindow, projectAbbrev)
    await mainWindow.waitForTimeout(500)

    // Tag filter button: Button with "Tags" text in the filter bar
    const tagButton = mainWindow.locator('button').filter({ hasText: 'Tags' })
    await expect(tagButton.first()).toBeVisible({ timeout: 5_000 })
  })

  test('delete tag in settings', async ({ mainWindow }) => {
    await clickSettings(mainWindow)
    await mainWindow.getByRole('tab', { name: 'Tags' }).click()
    await mainWindow.waitForTimeout(300)

    // Find tag text, navigate to parent row, click its Delete button
    const tagRow = mainWindow.getByText('e2e-tag-2', { exact: true }).locator('..')
    await tagRow.getByRole('button', { name: 'Delete' }).click()
    await mainWindow.waitForTimeout(500)

    await expect(mainWindow.getByText('e2e-tag-2')).not.toBeVisible({ timeout: 3_000 })

    // Close settings
    await mainWindow.keyboard.press('Escape')
  })
})
