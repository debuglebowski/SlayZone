import { test, expect, seed, clickSettings } from './fixtures/electron'

test.describe('Settings', () => {
  const settingsDialog = (mainWindow: import('@playwright/test').Page) =>
    mainWindow.getByRole('dialog').last()

  const openSettingsDialog = async (mainWindow: import('@playwright/test').Page) => {
    const dialog = settingsDialog(mainWindow)
    if (!(await dialog.isVisible().catch(() => false))) {
      await clickSettings(mainWindow)
      await expect(dialog).toBeVisible({ timeout: 5_000 })
    }
    await dialog.locator('aside button').filter({ hasText: 'General' }).first().click()
    await expect(dialog.getByText('Preferred port')).toBeVisible({ timeout: 5_000 })
    return dialog
  }

  const findCard = (dialog: import('@playwright/test').Locator, name: string) =>
    dialog.locator('.space-y-2 > *').filter({ hasText: name }).first()

  const openTerminalSettings = async (mainWindow: import('@playwright/test').Page) => {
    const dialog = settingsDialog(mainWindow)
    if (await dialog.isVisible().catch(() => false)) {
      await mainWindow.keyboard.press('Escape')
      await expect(dialog).not.toBeVisible({ timeout: 5_000 })
    }
    await openSettingsDialog(mainWindow)
    // Terminal config is inside the Panels tab.
    await dialog.locator('aside button').filter({ hasText: 'Panels' }).first().click()
    await expect(findCard(settingsDialog(mainWindow), 'Terminal')).toBeVisible({ timeout: 5_000 })
    // Terminal row is clickable and opens the terminal detail settings.
    const terminalCard = findCard(dialog, 'Terminal')
    await terminalCard.click()
    await expect(dialog.getByText('Default mode')).toBeVisible({ timeout: 5_000 })
  }

  test('open settings dialog', async ({ mainWindow }) => {
    await openSettingsDialog(mainWindow)
  })

  test('Cmd+, opens settings dialog', async ({ mainWindow }) => {
    await mainWindow.keyboard.press('Meta+,')
    await expect(settingsDialog(mainWindow)).toBeVisible({ timeout: 5_000 })
    await expect(settingsDialog(mainWindow).getByText('Preferred port')).toBeVisible({ timeout: 5_000 })
  })

  test('switch theme to dark', async ({ mainWindow }) => {
    const dialog = await openSettingsDialog(mainWindow)
    await dialog.locator('aside button').filter({ hasText: 'Appearance' }).first().click()
    const modeTrigger = dialog.locator('[data-slot="select-trigger"]').first()
    await modeTrigger.click()
    await mainWindow.getByRole('option', { name: 'Dark', exact: true }).click()
    await expect(mainWindow.locator('html')).toHaveClass(/dark/)
  })

  test('switch theme to light', async ({ mainWindow }) => {
    const dialog = await openSettingsDialog(mainWindow)
    await dialog.locator('aside button').filter({ hasText: 'Appearance' }).first().click()
    const modeTrigger = dialog.locator('[data-slot="select-trigger"]').first()
    await modeTrigger.click()
    await mainWindow.getByRole('option', { name: /Light/ }).click()
    await expect(mainWindow.locator('html')).not.toHaveClass(/dark/)
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
