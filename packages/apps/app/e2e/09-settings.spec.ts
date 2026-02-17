import { test, expect, seed, clickSettings } from './fixtures/electron'

test.describe('Settings', () => {
  const settingsDialog = (mainWindow: import('@playwright/test').Page) =>
    mainWindow.getByRole('dialog').last()

  const findCard = (dialog: import('@playwright/test').Locator, name: string) =>
    dialog.locator('.space-y-2 > div').filter({ hasText: name }).first()

  const openTerminalSettings = async (mainWindow: import('@playwright/test').Page) => {
    const dialog = settingsDialog(mainWindow)
    if (await dialog.isVisible().catch(() => false)) {
      await mainWindow.keyboard.press('Escape')
      await expect(dialog).not.toBeVisible({ timeout: 5_000 })
    }
    await clickSettings(mainWindow)
    await expect(dialog).toBeVisible({ timeout: 5_000 })
    // Terminal config is inside the Panels tab → Terminal card → gear button
    await dialog.locator('aside button').filter({ hasText: 'Panels' }).first().click()
    await expect(findCard(settingsDialog(mainWindow), 'Terminal')).toBeVisible({ timeout: 5_000 })
    // Click the gear button (only non-switch button in the card header)
    const terminalCard = findCard(dialog, 'Terminal')
    await terminalCard.locator('button:not([role="switch"])').first().click()
    await expect(dialog.getByText('Default mode')).toBeVisible({ timeout: 5_000 })
  }

  test('open settings dialog', async ({ mainWindow }) => {
    await clickSettings(mainWindow)
    await expect(mainWindow.getByText('Worktree base path')).toBeVisible({ timeout: 5_000 })
  })

  test('Cmd+, opens settings dialog', async ({ mainWindow }) => {
    await mainWindow.keyboard.press('Meta+,')
    await expect(mainWindow.getByText('Worktree base path')).toBeVisible({ timeout: 5_000 })
  })

  test('switch theme to dark', async ({ mainWindow }) => {
    const themeSelect = mainWindow.locator('select').filter({ hasText: /Light|Dark|System/ }).first()
    if (await themeSelect.isVisible().catch(() => false)) {
      await themeSelect.selectOption('dark')
      await expect(mainWindow.locator('html')).toHaveClass(/dark/)
    }
  })

  test('switch theme to light', async ({ mainWindow }) => {
    const themeSelect = mainWindow.locator('select').filter({ hasText: /Light|Dark|System/ }).first()
    if (await themeSelect.isVisible().catch(() => false)) {
      await themeSelect.selectOption('light')
      await expect(mainWindow.locator('html')).not.toHaveClass(/dark/)
    }
  })

  test('default terminal mode in settings reflects DB value', async ({ mainWindow }) => {
    const s = seed(mainWindow)
    await s.setSetting('default_terminal_mode', 'codex')
    await expect.poll(async () => s.getSetting('default_terminal_mode')).toBe('codex')

    await openTerminalSettings(mainWindow)

    const modeTrigger = settingsDialog(mainWindow)
      .locator('[data-slot="select-trigger"]')
      .first()
    await expect(modeTrigger).toHaveText(/Codex/)

    // Restore default to claude-code so subsequent tests get the real default
    await s.setSetting('default_terminal_mode', 'claude-code')
  })

  test('close settings dialog', async ({ mainWindow }) => {
    await mainWindow.keyboard.press('Escape')
    await expect(settingsDialog(mainWindow)).not.toBeVisible({ timeout: 3_000 })
  })
})
