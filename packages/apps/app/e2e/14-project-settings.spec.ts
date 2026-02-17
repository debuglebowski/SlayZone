import { test, expect, seed, goHome, clickProject, projectBlob } from './fixtures/electron'
import { TEST_PROJECT_PATH } from './fixtures/electron'

test.describe('Project settings & context menu', () => {
  let projectAbbrev: string

  test.beforeAll(async ({ mainWindow }) => {
    const s = seed(mainWindow)
    // Create a dedicated project for this test
    const project = await s.createProject({ name: 'Settings Test', color: '#10b981', path: TEST_PROJECT_PATH })
    projectAbbrev = project.name.slice(0, 2).toUpperCase()
    await s.refreshData()
    await goHome(mainWindow)
    await mainWindow.waitForTimeout(300)
  })

  test('right-click project blob opens context menu', async ({ mainWindow }) => {
    const blob = projectBlob(mainWindow, projectAbbrev)
    await blob.click({ button: 'right' })
    await mainWindow.waitForTimeout(300)

    await expect(mainWindow.getByRole('menuitem', { name: 'Settings' })).toBeVisible({ timeout: 3_000 })
    await expect(mainWindow.getByRole('menuitem', { name: 'Delete' })).toBeVisible()

    // Dismiss context menu so it doesn't block subsequent tests
    await mainWindow.keyboard.press('Escape')
    await mainWindow.waitForTimeout(200)
  })

  test('context menu Settings opens project settings dialog', async ({ mainWindow }) => {
    // Re-open context menu (may have closed between tests)
    const blob = projectBlob(mainWindow, projectAbbrev)
    await blob.click({ button: 'right' })
    await mainWindow.waitForTimeout(300)

    await mainWindow.getByRole('menuitem', { name: 'Settings' }).click()

    await expect(mainWindow.getByRole('heading', { name: 'Project Settings' })).toBeVisible({ timeout: 5_000 })
    // General tab is default — verify name input exists
    await expect(mainWindow.locator('#edit-name')).toBeVisible({ timeout: 3_000 })
    // Switch to Integrations tab
    await mainWindow.getByText('Integrations').click()
    await expect(mainWindow.getByText('Mapping', { exact: true })).toBeVisible({ timeout: 3_000 })
    await expect(mainWindow.getByText('Import Issues', { exact: true })).toBeVisible()
    // Switch back to General for the next test (edit name)
    await mainWindow.getByText('General').click()
    await expect(mainWindow.locator('#edit-name')).toBeVisible({ timeout: 3_000 })
  })

  test('edit project name in settings dialog', async ({ mainWindow }) => {
    const nameInput = mainWindow.locator('#edit-name')
    await nameInput.clear()
    await nameInput.fill('Xylo Project')

    await mainWindow.getByRole('button', { name: 'Save' }).click()
    await mainWindow.waitForTimeout(500)

    // Dialog should close
    await expect(mainWindow.getByRole('heading', { name: 'Project Settings' })).not.toBeVisible({ timeout: 3_000 })

    // Sidebar should show new abbreviation
    projectAbbrev = 'XY'
    await expect(projectBlob(mainWindow, 'XY')).toBeVisible({ timeout: 3_000 })
  })

  test('project rename persisted in DB', async ({ mainWindow }) => {
    const projects = await seed(mainWindow).getProjects()
    const renamed = projects.find((p: { name: string }) => p.name === 'Xylo Project')
    expect(renamed).toBeTruthy()
  })

  test('context menu Delete opens delete dialog', async ({ mainWindow }) => {
    const blob = projectBlob(mainWindow, projectAbbrev)
    await blob.click({ button: 'right' })
    await mainWindow.waitForTimeout(300)

    await mainWindow.getByRole('menuitem', { name: 'Delete' }).click()
    await mainWindow.waitForTimeout(300)

    // Delete confirmation dialog should appear
    const deleteText = mainWindow.getByText(/delete|Are you sure/i)
    await expect(deleteText.first()).toBeVisible({ timeout: 3_000 })

    // Cancel — don't actually delete
    const cancelBtn = mainWindow.getByRole('button', { name: /Cancel/i })
    if (await cancelBtn.isVisible().catch(() => false)) {
      await cancelBtn.click()
    } else {
      await mainWindow.keyboard.press('Escape')
    }
    await mainWindow.waitForTimeout(300)
  })
})
