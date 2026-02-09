import { test, expect, seed, clickSettings } from './fixtures/electron'

test.describe('Settings', () => {
  const settingsDialog = (mainWindow: import('@playwright/test').Page) =>
    mainWindow.getByRole('dialog').last()

  const openTerminalSettings = async (mainWindow: import('@playwright/test').Page) => {
    const dialog = settingsDialog(mainWindow)
    if (await dialog.isVisible().catch(() => false)) {
      await mainWindow.keyboard.press('Escape')
      await expect(dialog).not.toBeVisible({ timeout: 5_000 })
    }
    await clickSettings(mainWindow)
    await expect(dialog).toBeVisible({ timeout: 5_000 })
    await dialog.locator('aside button').filter({ hasText: 'Terminal' }).first().click()
    await expect(dialog.getByText('Default mode')).toBeVisible({ timeout: 5_000 })
  }

  test('open settings dialog', async ({ mainWindow }) => {
    await clickSettings(mainWindow)
    await expect(mainWindow.getByText('Appearance')).toBeVisible({ timeout: 5_000 })
  })

  test('Cmd+, opens settings dialog', async ({ mainWindow }) => {
    await mainWindow.keyboard.press('Meta+,')
    await expect(mainWindow.getByText('Appearance')).toBeVisible({ timeout: 5_000 })
  })

  test('switch theme to dark', async ({ mainWindow }) => {
    const themeSelect = mainWindow.locator('select').filter({ hasText: /Light|Dark|System/ }).first()
    if (await themeSelect.isVisible().catch(() => false)) {
      await themeSelect.selectOption('dark')
      await mainWindow.waitForTimeout(500)

      const isDark = await mainWindow.evaluate(() =>
        document.documentElement.classList.contains('dark')
      )
      expect(isDark).toBe(true)
    }
  })

  test('switch theme to light', async ({ mainWindow }) => {
    const themeSelect = mainWindow.locator('select').filter({ hasText: /Light|Dark|System/ }).first()
    if (await themeSelect.isVisible().catch(() => false)) {
      await themeSelect.selectOption('light')
      await mainWindow.waitForTimeout(500)

      const isDark = await mainWindow.evaluate(() =>
        document.documentElement.classList.contains('dark')
      )
      expect(isDark).toBe(false)
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
  })

  test('close settings dialog', async ({ mainWindow }) => {
    await mainWindow.keyboard.press('Escape')
    await expect(mainWindow.getByText('Appearance')).not.toBeVisible({ timeout: 3_000 })
  })
})
