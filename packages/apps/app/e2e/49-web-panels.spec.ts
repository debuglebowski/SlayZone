import { test, expect, seed, clickSettings, clickProject, goHome } from './fixtures/electron'
import { TEST_PROJECT_PATH } from './fixtures/electron'

test.describe('Web panels', () => {
  let projectAbbrev: string

  const settingsDialog = (page: import('@playwright/test').Page) =>
    page.getByRole('dialog').last()

  /** Find a panel card in settings by name. */
  const findCard = (
    dialog: import('@playwright/test').Locator,
    name: string
  ) =>
    dialog.locator('.space-y-2 > div').filter({ hasText: name }).first()

  /** Non-switch buttons inside a card (gear, trash, pencil). */
  const cardButtons = (card: import('@playwright/test').Locator) =>
    card.locator('button:not([role="switch"])')

  const openPanelsTab = async (page: import('@playwright/test').Page) => {
    const dialog = settingsDialog(page)
    if (!(await dialog.isVisible().catch(() => false))) {
      await clickSettings(page)
      await expect(dialog).toBeVisible({ timeout: 5_000 })
    }
    await dialog.locator('aside button').filter({ hasText: 'Panels' }).first().click()
    // Wait for async loadData to populate panel cards
    await expect(findCard(settingsDialog(page), 'Terminal')).toBeVisible({ timeout: 5_000 })
  }

  const closePanelsTab = async (page: import('@playwright/test').Page) => {
    await page.keyboard.press('Escape')
    await expect(settingsDialog(page)).not.toBeVisible({ timeout: 5_000 })
  }

  const openTaskViaSearch = async (page: import('@playwright/test').Page, title: string) => {
    await page.keyboard.press('Meta+k')
    const input = page.getByPlaceholder('Search tasks and projects...')
    await expect(input).toBeVisible()
    await input.fill(title)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(500)
  }

  test.beforeAll(async ({ mainWindow }) => {
    const s = seed(mainWindow)
    await s.setSetting('panel_config', '')

    const p = await s.createProject({
      name: 'WebPanels',
      color: '#f59e0b',
      path: TEST_PROJECT_PATH
    })
    projectAbbrev = p.name.slice(0, 2).toUpperCase()
    await s.createTask({ projectId: p.id, title: 'WP test task', status: 'todo' })
    await s.refreshData()

    await goHome(mainWindow)
    await clickProject(mainWindow, projectAbbrev)
    await mainWindow.waitForTimeout(500)
  })

  // ── Settings: panels tab ──

  test('panels tab shows native and external sections', async ({ mainWindow }) => {
    await openPanelsTab(mainWindow)
    const dialog = settingsDialog(mainWindow)

    for (const name of ['Terminal', 'Browser', 'Editor', 'Diff', 'Settings']) {
      await expect(findCard(dialog, name)).toBeVisible({ timeout: 3_000 })
    }
    for (const name of ['Figma', 'Notion', 'GitHub', 'Excalidraw']) {
      await expect(findCard(dialog, name)).toBeVisible({ timeout: 3_000 })
    }
  })

  test('predefined externals are disabled by default', async ({ mainWindow }) => {
    const dialog = settingsDialog(mainWindow)
    for (const name of ['Figma', 'Notion', 'GitHub', 'Excalidraw']) {
      await expect(findCard(dialog, name).getByRole('switch'))
        .toHaveAttribute('data-state', 'unchecked')
    }
  })

  // ── Add custom panel (uses 'j' — letters like z/p/c/v are Electron menu accelerators) ──

  test('add custom web panel', async ({ mainWindow }) => {
    const dialog = settingsDialog(mainWindow)

    const nameInput = dialog.getByPlaceholder('Name (e.g. Miro)')
    await nameInput.scrollIntoViewIfNeeded()
    await nameInput.fill('TestPanel')
    await dialog.getByPlaceholder('URL (e.g. miro.com)').fill('example.com')
    await dialog.getByPlaceholder('Key').last().fill('j')

    await dialog.getByRole('button', { name: 'Add Panel' }).click()
    await mainWindow.waitForTimeout(300)

    const card = findCard(dialog, 'TestPanel')
    await expect(card).toBeVisible({ timeout: 3_000 })
    await expect(card.getByRole('switch')).toHaveAttribute('data-state', 'checked')
  })

  test('enable Figma panel', async ({ mainWindow }) => {
    const dialog = settingsDialog(mainWindow)
    const switchEl = findCard(dialog, 'Figma').getByRole('switch')
    await expect(switchEl).toHaveAttribute('data-state', 'unchecked')
    await switchEl.click()
    await mainWindow.waitForTimeout(300)
    await expect(switchEl).toHaveAttribute('data-state', 'checked')
  })

  test('edit Figma panel name', async ({ mainWindow }) => {
    const dialog = settingsDialog(mainWindow)
    const figmaCard = findCard(dialog, 'Figma')
    await expect(figmaCard).toBeVisible({ timeout: 3_000 })

    // Pencil = 2nd non-switch button (after trash)
    await cardButtons(figmaCard).nth(1).click()
    await mainWindow.waitForTimeout(200)

    const nameInput = dialog.getByPlaceholder('Name').first()
    await expect(nameInput).toHaveValue('Figma')
    await nameInput.clear()
    await nameInput.fill('Figma Design')
    await dialog.getByRole('button', { name: 'Save' }).click()
    await mainWindow.waitForTimeout(300)

    await expect(findCard(dialog, 'Figma Design')).toBeVisible({ timeout: 3_000 })
  })

  // ── Close settings, test keyboard shortcuts ──

  test('close settings and open task', async ({ mainWindow }) => {
    await closePanelsTab(mainWindow)
    await openTaskViaSearch(mainWindow, 'WP test task')
  })

  test('Cmd+J toggles custom web panel on', async ({ mainWindow }) => {
    // Focus a safe element first (avoid webview stealing keystrokes)
    const titleEl = mainWindow.locator('h1, [data-testid="task-title"]').first()
    if (await titleEl.isVisible().catch(() => false)) await titleEl.click()
    await mainWindow.waitForTimeout(100)

    await mainWindow.keyboard.press('Meta+j')
    await mainWindow.waitForTimeout(500)

    await expect(
      mainWindow.locator('span').filter({ hasText: 'TestPanel' }).last()
    ).toBeVisible({ timeout: 5_000 })
  })

  test('Cmd+J toggles custom web panel off', async ({ mainWindow }) => {
    // Focus outside webview before pressing shortcut again
    const titleEl = mainWindow.locator('h1, [data-testid="task-title"]').first()
    if (await titleEl.isVisible().catch(() => false)) await titleEl.click()
    await mainWindow.waitForTimeout(100)

    await mainWindow.keyboard.press('Meta+j')
    await mainWindow.waitForTimeout(500)

    await expect(
      mainWindow.locator('span').filter({ hasText: 'TestPanel' }).last()
    ).not.toBeVisible({ timeout: 3_000 })
  })

  // ── Delete panels ──

  test('delete Figma Design, stays deleted after reopen', async ({ mainWindow }) => {
    await openPanelsTab(mainWindow)
    const dialog = settingsDialog(mainWindow)

    const card = findCard(dialog, 'Figma Design')
    await expect(card).toBeVisible({ timeout: 5_000 })
    await cardButtons(card).first().click() // trash
    await mainWindow.waitForTimeout(300)

    await expect(findCard(dialog, 'Figma Design')).not.toBeVisible({ timeout: 3_000 })

    // Reopen — mergePredefined should NOT re-add it
    await closePanelsTab(mainWindow)
    await openPanelsTab(mainWindow)
    await expect(findCard(settingsDialog(mainWindow), 'Figma Design'))
      .not.toBeVisible({ timeout: 3_000 })
  })

  test('delete custom TestPanel', async ({ mainWindow }) => {
    const dialog = settingsDialog(mainWindow)
    const card = findCard(dialog, 'TestPanel')
    await expect(card).toBeVisible({ timeout: 5_000 })
    await cardButtons(card).first().click()
    await mainWindow.waitForTimeout(300)

    await expect(findCard(dialog, 'TestPanel')).not.toBeVisible({ timeout: 3_000 })
  })

  // ── Shortcut validation ──

  test('shortcut validation rejects reserved keys', async ({ mainWindow }) => {
    const dialog = settingsDialog(mainWindow)
    const nameInput = dialog.getByPlaceholder('Name (e.g. Miro)')
    await nameInput.scrollIntoViewIfNeeded()
    await nameInput.fill('BadShortcut')
    await dialog.getByPlaceholder('URL (e.g. miro.com)').fill('test.com')
    await dialog.getByPlaceholder('Key').last().fill('t')
    await mainWindow.waitForTimeout(200)

    await expect(dialog.getByText(/reserved/i).first()).toBeVisible({ timeout: 3_000 })

    await nameInput.clear()
    await dialog.getByPlaceholder('URL (e.g. miro.com)').clear()
    await dialog.getByPlaceholder('Key').last().clear()
  })

  // ── Native gear buttons ──
  // Fresh dialog open guarantees configuringNativeId is null (state from prior
  // test suites like 09-settings may linger otherwise).

  test('terminal gear button toggles config section', async ({ mainWindow }) => {
    await closePanelsTab(mainWindow)
    await openPanelsTab(mainWindow)
    const dialog = settingsDialog(mainWindow)
    const card = findCard(dialog, 'Terminal')
    await expect(card).toBeVisible({ timeout: 5_000 })

    // Dialog component stays mounted when closed — state (configuringNativeId)
    // may persist from prior test suites. Collapse first if already expanded.
    const defaultModeText = dialog.getByText('Default mode')
    if (await defaultModeText.isVisible().catch(() => false)) {
      await cardButtons(card).first().click()
      await mainWindow.waitForTimeout(300)
    }
    await expect(defaultModeText).not.toBeVisible({ timeout: 3_000 })

    // Toggle open
    await cardButtons(card).first().click()
    await mainWindow.waitForTimeout(300)
    await expect(defaultModeText).toBeVisible({ timeout: 5_000 })

    // Toggle closed
    await cardButtons(card).first().click()
    await mainWindow.waitForTimeout(300)
    await expect(defaultModeText).not.toBeVisible({ timeout: 3_000 })
  })

  test('browser gear button toggles config section', async ({ mainWindow }) => {
    const dialog = settingsDialog(mainWindow)
    const card = findCard(dialog, 'Browser')
    await expect(card).toBeVisible({ timeout: 5_000 })

    await expect(dialog.getByText('Show toast when dev server detected'))
      .not.toBeVisible({ timeout: 2_000 })
    await cardButtons(card).first().click()
    await mainWindow.waitForTimeout(300)
    await expect(dialog.getByText('Show toast when dev server detected'))
      .toBeVisible({ timeout: 5_000 })

    await cardButtons(card).first().click()
    await mainWindow.waitForTimeout(300)
  })

  // ── Disable native panel ──

  test('disabling Editor panel prevents shortcut in task detail', async ({ mainWindow }) => {
    const dialog = settingsDialog(mainWindow)
    const card = findCard(dialog, 'Editor')
    await expect(card).toBeVisible({ timeout: 5_000 })
    const switchEl = card.getByRole('switch')

    if ((await switchEl.getAttribute('data-state')) === 'checked') {
      await switchEl.click()
      await mainWindow.waitForTimeout(300)
    }
    await expect(switchEl).toHaveAttribute('data-state', 'unchecked')

    await closePanelsTab(mainWindow)

    await mainWindow.keyboard.press('Meta+e')
    await mainWindow.waitForTimeout(300)
    expect(await mainWindow.locator('[data-testid="file-editor-panel"]:visible').count()).toBe(0)

    // Re-enable
    await openPanelsTab(mainWindow)
    await findCard(settingsDialog(mainWindow), 'Editor').getByRole('switch').click()
    await mainWindow.waitForTimeout(300)
    await closePanelsTab(mainWindow)
  })

  test('cleanup: go home', async ({ mainWindow }) => {
    await goHome(mainWindow)
    await mainWindow.waitForTimeout(300)
  })
})
