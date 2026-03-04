import {
  test,
  expect,
  seed,
  clickProject,
  clickAddProject,
  projectBlob,
  TEST_PROJECT_PATH,
} from './fixtures/electron'

test.describe('Projects', () => {
  test('create project via sidebar', async ({ mainWindow }) => {
    await clickAddProject(mainWindow)

    await mainWindow.getByPlaceholder('Project name').fill('Test Project')
    await mainWindow.getByPlaceholder('/path/to/repo').fill(TEST_PROJECT_PATH)
    await mainWindow.getByRole('button', { name: 'Create', exact: true }).click()

    await expect(projectBlob(mainWindow, 'TE')).toBeVisible({ timeout: 5_000 })
  })

  test('create second project', async ({ mainWindow }) => {
    await clickAddProject(mainWindow)
    await mainWindow.getByPlaceholder('Project name').fill('Second Project')
    await mainWindow.getByRole('button', { name: 'Create', exact: true }).click()

    await expect(projectBlob(mainWindow, 'SE')).toBeVisible({ timeout: 5_000 })
  })

  test('create project with Linear start option opens integration setup wizard', async ({ mainWindow }) => {
    await clickAddProject(mainWindow)
    await mainWindow.getByPlaceholder('Project name').fill('Linear Sync Project')
    await mainWindow.locator('button').filter({ hasText: 'Sync with Linear' }).first().click()
    await mainWindow.getByRole('button', { name: 'Create and continue' }).click()

    await expect(projectBlob(mainWindow, 'LI')).toBeVisible({ timeout: 5_000 })
    await expect(mainWindow.getByRole('heading', { name: 'Project Settings' })).toBeVisible({ timeout: 5_000 })
    await expect(mainWindow.getByText('Linear Setup Wizard')).toBeVisible({ timeout: 5_000 })

    await mainWindow.keyboard.press('Escape')
    await expect(mainWindow.getByRole('heading', { name: 'Project Settings' })).not.toBeVisible({ timeout: 3_000 })
  })

  test('create project with GitHub Projects option opens GitHub setup wizard', async ({ mainWindow }) => {
    await clickAddProject(mainWindow)
    await mainWindow.getByPlaceholder('Project name').fill('GitHub Sync Project')
    await mainWindow.locator('button').filter({ hasText: 'Sync with GitHub Projects' }).first().click()
    await mainWindow.getByRole('button', { name: 'Create and continue' }).click()

    await expect(projectBlob(mainWindow, 'GI')).toBeVisible({ timeout: 5_000 })
    await expect(mainWindow.getByRole('heading', { name: 'Project Settings' })).toBeVisible({ timeout: 5_000 })
    await expect(mainWindow.getByText('GitHub Project Setup Wizard')).toBeVisible({ timeout: 5_000 })

    await mainWindow.keyboard.press('Escape')
    await expect(mainWindow.getByRole('heading', { name: 'Project Settings' })).not.toBeVisible({ timeout: 3_000 })
  })

  test('switch between projects', async ({ mainWindow }) => {
    await clickProject(mainWindow, 'TE')
    // Project name is in a <textarea>, not h1
    await expect(mainWindow.locator('textarea').first()).toHaveValue('Test Project', { timeout: 5_000 })

    await clickProject(mainWindow, 'SE')
    await expect(mainWindow.locator('textarea').first()).toHaveValue('Second Project', { timeout: 5_000 })
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
