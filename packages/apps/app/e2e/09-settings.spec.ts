import { test, expect, seed, clickSettings } from './fixtures/electron'

test.describe('Settings', () => {
  test('open settings dialog', async ({ mainWindow }) => {
    await clickSettings(mainWindow)
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

  test('close settings dialog', async ({ mainWindow }) => {
    await mainWindow.keyboard.press('Escape')
    await expect(mainWindow.getByText('Appearance')).not.toBeVisible({ timeout: 3_000 })
  })
})
