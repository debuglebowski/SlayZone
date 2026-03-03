import { test, expect, seed, goHome, projectBlob } from './fixtures/electron'
import { TEST_PROJECT_PATH } from './fixtures/electron'

test.describe('Project execution context settings', () => {
  let projectAbbrev: string
  let projectId: string

  test.beforeAll(async ({ mainWindow }) => {
    const s = seed(mainWindow)
    const project = await s.createProject({ name: 'Exec Ctx', color: '#7c3aed', path: TEST_PROJECT_PATH })
    projectId = project.id
    projectAbbrev = project.name.slice(0, 2).toUpperCase()
    await s.refreshData()
    await goHome(mainWindow)
    await expect(projectBlob(mainWindow, projectAbbrev)).toBeVisible({ timeout: 5_000 })
  })

  // ---------------------------------------------------------------------------
  // Helper: ensure project settings dialog is open on Environment tab
  // ---------------------------------------------------------------------------
  async function openSettings(mainWindow: import('@playwright/test').Page) {
    const heading = mainWindow.getByRole('heading', { name: 'Project Settings' })
    if (!(await heading.isVisible().catch(() => false))) {
      const blob = projectBlob(mainWindow, projectAbbrev)
      await blob.click({ button: 'right' })
      await mainWindow.getByRole('menuitem', { name: 'Settings' }).click()
      await expect(heading).toBeVisible({ timeout: 5_000 })
    }
    await mainWindow.getByText('Environment', { exact: true }).first().click()
    await expect(mainWindow.locator('#exec-context')).toBeVisible({ timeout: 3_000 })
  }

  // ---------------------------------------------------------------------------
  // 1) Default execution context is "This machine"
  // ---------------------------------------------------------------------------
  test('default execution context is Local', async ({ mainWindow }) => {
    await openSettings(mainWindow)
    const trigger = mainWindow.locator('#exec-context')
    await expect(trigger).toBeVisible({ timeout: 3_000 })
    await expect(trigger).toHaveText(/This machine/)
  })

  // ---------------------------------------------------------------------------
  // 2) Selecting Docker shows docker-specific fields
  // ---------------------------------------------------------------------------
  test('selecting Docker shows container fields', async ({ mainWindow }) => {
    await openSettings(mainWindow)
    const trigger = mainWindow.locator('#exec-context')
    await trigger.click()
    await mainWindow.getByRole('option', { name: 'A Docker container' }).click()
    await expect(mainWindow.locator('#exec-container')).toBeVisible({ timeout: 3_000 })
    await expect(mainWindow.locator('#exec-workdir')).toBeVisible()
    await expect(mainWindow.locator('#exec-shell')).toBeVisible()
  })

  // ---------------------------------------------------------------------------
  // 3) Selecting SSH shows ssh-specific fields
  // ---------------------------------------------------------------------------
  test('selecting SSH shows target fields', async ({ mainWindow }) => {
    await openSettings(mainWindow)
    const trigger = mainWindow.locator('#exec-context')
    await trigger.click()
    await mainWindow.getByRole('option', { name: 'A remote machine (SSH)' }).click()
    await expect(mainWindow.locator('#exec-ssh-target')).toBeVisible({ timeout: 3_000 })
    await expect(mainWindow.locator('#exec-workdir-ssh')).toBeVisible()
    await expect(mainWindow.locator('#exec-shell-ssh')).toBeVisible()
  })

  // ---------------------------------------------------------------------------
  // 4) Save Docker config and verify DB roundtrip
  // ---------------------------------------------------------------------------
  test('save docker execution context persists in DB', async ({ mainWindow }) => {
    await openSettings(mainWindow)
    const trigger = mainWindow.locator('#exec-context')
    await trigger.click()
    await mainWindow.getByRole('option', { name: 'A Docker container' }).click()

    await mainWindow.locator('#exec-container').fill('my-dev-container')
    await mainWindow.locator('#exec-workdir').fill('/workspace')
    await mainWindow.locator('#exec-shell').fill('/bin/zsh')

    await mainWindow.getByRole('button', { name: 'Save' }).click()
    await expect(mainWindow.getByRole('heading', { name: 'Project Settings' }))
      .not.toBeVisible({ timeout: 3_000 })

    // Verify DB
    const projects = await seed(mainWindow).getProjects()
    const project = projects.find((p: { id: string }) => p.id === projectId) as {
      execution_context: { type: string; container: string; workdir: string; shell: string } | null
    }
    expect(project?.execution_context).toEqual({
      type: 'docker',
      container: 'my-dev-container',
      workdir: '/workspace',
      shell: '/bin/zsh'
    })
  })

  // ---------------------------------------------------------------------------
  // 5) Reopen dialog — Docker fields are pre-filled
  // ---------------------------------------------------------------------------
  test('docker fields are restored on reopen', async ({ mainWindow }) => {
    await openSettings(mainWindow)
    await expect(mainWindow.locator('#exec-context')).toHaveText(/Docker container/)
    await expect(mainWindow.locator('#exec-container')).toHaveValue('my-dev-container')
    await expect(mainWindow.locator('#exec-workdir')).toHaveValue('/workspace')
    await expect(mainWindow.locator('#exec-shell')).toHaveValue('/bin/zsh')
  })

  // ---------------------------------------------------------------------------
  // 6) Switch to SSH, save, verify roundtrip
  // ---------------------------------------------------------------------------
  test('save ssh execution context persists in DB', async ({ mainWindow }) => {
    await openSettings(mainWindow)
    const trigger = mainWindow.locator('#exec-context')
    await trigger.click()
    await mainWindow.getByRole('option', { name: 'A remote machine (SSH)' }).click()

    await mainWindow.locator('#exec-ssh-target').fill('user@remote-host')
    await mainWindow.locator('#exec-workdir-ssh').fill('/home/user/project')

    await mainWindow.getByRole('button', { name: 'Save' }).click()
    await expect(mainWindow.getByRole('heading', { name: 'Project Settings' }))
      .not.toBeVisible({ timeout: 3_000 })

    const projects = await seed(mainWindow).getProjects()
    const project = projects.find((p: { id: string }) => p.id === projectId) as {
      execution_context: { type: string; target: string; workdir: string } | null
    }
    expect(project?.execution_context).toEqual({
      type: 'ssh',
      target: 'user@remote-host',
      workdir: '/home/user/project'
    })
  })

  // ---------------------------------------------------------------------------
  // 7) Switch back to Local, save, verify null in DB
  // ---------------------------------------------------------------------------
  test('switching to Local clears execution context', async ({ mainWindow }) => {
    await openSettings(mainWindow)
    const trigger = mainWindow.locator('#exec-context')
    await trigger.click()
    await mainWindow.getByRole('option', { name: 'This machine' }).click()

    await mainWindow.getByRole('button', { name: 'Save' }).click()
    await expect(mainWindow.getByRole('heading', { name: 'Project Settings' }))
      .not.toBeVisible({ timeout: 3_000 })

    const projects = await seed(mainWindow).getProjects()
    const project = projects.find((p: { id: string }) => p.id === projectId) as {
      execution_context: unknown
    }
    expect(project?.execution_context).toBeNull()
  })

  // ---------------------------------------------------------------------------
  // 8) Test connection button shows failure for nonexistent container
  // ---------------------------------------------------------------------------
  test('test connection shows failure for nonexistent docker container', async ({ mainWindow }) => {
    await openSettings(mainWindow)
    const trigger = mainWindow.locator('#exec-context')
    await trigger.click()
    await mainWindow.getByRole('option', { name: 'A Docker container' }).click()
    await mainWindow.locator('#exec-container').fill('nonexistent-container-12345')

    await mainWindow.getByRole('button', { name: 'Test connection' }).click()

    // Should show error (docker not found or container not running)
    await expect(mainWindow.getByText(/Failed|Error|not found|No such container/i).first())
      .toBeVisible({ timeout: 15_000 })

    // Close without saving
    await mainWindow.keyboard.press('Escape')
  })

  // ---------------------------------------------------------------------------
  // 9) Test connection shows failure for nonexistent SSH target
  // ---------------------------------------------------------------------------
  test('test connection shows failure for nonexistent ssh target', async ({ mainWindow }) => {
    await openSettings(mainWindow)
    const trigger = mainWindow.locator('#exec-context')
    await trigger.click()
    await mainWindow.getByRole('option', { name: 'A remote machine (SSH)' }).click()
    await mainWindow.locator('#exec-ssh-target').fill('user@192.0.2.1')

    await mainWindow.getByRole('button', { name: 'Test connection' }).click()

    // Should show error (connection refused / timeout)
    await expect(mainWindow.getByText(/Failed|Error|timed out|refused|Could not resolve/i).first())
      .toBeVisible({ timeout: 15_000 })

    // Close without saving
    await mainWindow.keyboard.press('Escape')
  })

  // ---------------------------------------------------------------------------
  // 10) DB seeded execution context is reflected in UI
  // ---------------------------------------------------------------------------
  test('DB-seeded execution context appears in settings UI', async ({ mainWindow }) => {
    // Seed directly via API
    await mainWindow.evaluate(
      ({ id }) => window.api.db.updateProject({
        id,
        executionContext: { type: 'docker', container: 'seeded-container', workdir: '/app' }
      }),
      { id: projectId }
    )
    await seed(mainWindow).refreshData()

    await openSettings(mainWindow)
    await expect(mainWindow.locator('#exec-context')).toHaveText(/Docker container/)
    await expect(mainWindow.locator('#exec-container')).toHaveValue('seeded-container')
    await expect(mainWindow.locator('#exec-workdir')).toHaveValue('/app')

    // Clean up — reset to host
    await mainWindow.evaluate(
      ({ id }) => window.api.db.updateProject({ id, executionContext: null }),
      { id: projectId }
    )
    await seed(mainWindow).refreshData()
    await mainWindow.keyboard.press('Escape')
  })
})
