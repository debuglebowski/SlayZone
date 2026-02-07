import {
  test,
  expect,
  seed,
  clickProject,
  clickAll,
  clickAddProject,
  projectBlob,
  goHome,
  TEST_PROJECT_PATH,
} from './fixtures/electron'

test.describe('Projects', () => {
  test('create project via sidebar', async ({ mainWindow }) => {
    await clickAddProject(mainWindow)

    await mainWindow.getByPlaceholder('Project name').fill('Test Project')
    await mainWindow.getByPlaceholder('/path/to/repo').fill(TEST_PROJECT_PATH)
    await mainWindow.getByRole('button', { name: 'Create' }).click()

    await expect(projectBlob(mainWindow, 'TE')).toBeVisible({ timeout: 5_000 })
  })

  test('create second project', async ({ mainWindow }) => {
    await clickAddProject(mainWindow)
    await mainWindow.getByPlaceholder('Project name').fill('Second Project')
    await mainWindow.getByRole('button', { name: 'Create' }).click()

    await expect(projectBlob(mainWindow, 'SE')).toBeVisible({ timeout: 5_000 })
  })

  test('switch between projects', async ({ mainWindow }) => {
    await clickProject(mainWindow, 'TE')
    // Project name is in a <textarea>, not h1
    await expect(mainWindow.locator('textarea').first()).toHaveValue('Test Project', { timeout: 5_000 })

    await clickProject(mainWindow, 'SE')
    await expect(mainWindow.locator('textarea').first()).toHaveValue('Second Project', { timeout: 5_000 })

    await clickAll(mainWindow)
    await expect(mainWindow.locator('h1')).toContainText('All Tasks', { timeout: 5_000 })
  })

  test('delete project via API', async ({ mainWindow }) => {
    const s = seed(mainWindow)
    const projects = await s.getProjects()
    const secondProject = projects.find((p: { name: string }) => p.name === 'Second Project')
    if (secondProject) {
      await s.deleteProject(secondProject.id)
    }
    await s.refreshData()

    await expect(projectBlob(mainWindow, 'SE')).not.toBeVisible({ timeout: 5_000 })
  })
})
