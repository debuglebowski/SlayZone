import { test, expect, seed } from './fixtures/electron'

test.describe('Onboarding', () => {
  test('onboarding is skipped when pre-seeded', async ({ mainWindow }) => {
    const completed = await mainWindow.evaluate(() => window.api.settings.get('onboarding_completed'))
    expect(completed).toBe('true')
    await expect(mainWindow.getByRole('heading', { name: 'Welcome to SlayZone' })).not.toBeVisible()
  })

  test('full onboarding flow', async ({ mainWindow }) => {
    const s = seed(mainWindow)

    try {
      // Clear the flag to trigger the dialog on reload
      await s.setSetting('onboarding_completed', '')
      await mainWindow.reload({ waitUntil: 'domcontentloaded' })
      await mainWindow.waitForSelector('#root', { timeout: 10_000 })

      const dialog = mainWindow
        .locator('[role="dialog"]')
        .filter({ hasText: /Welcome to SlayZone|Your AI, your responsibility|Choose your default AI|Analytics|You're all set!/i })
        .last()

      // Step 0: Welcome
      await expect(dialog.getByRole('heading', { name: 'Welcome to SlayZone' })).toBeVisible({ timeout: 5_000 })
      await dialog.getByRole('button', { name: 'Continue' }).click()

      // Step 1: Disclaimer
      await expect(dialog.getByText('Your AI, your responsibility')).toBeVisible()
      await dialog.getByRole('button', { name: 'I understand' }).click()

      // Step 2: Provider selection
      await expect(dialog.getByText('Choose your default AI')).toBeVisible()
      await dialog.getByRole('button', { name: 'Continue' }).click()

      // Step 3: Analytics
      await expect(dialog.getByRole('heading', { name: 'Analytics' })).toBeVisible()
      await dialog.getByRole('button', { name: 'No' }).click()

      // Step 4: Success (auto-closes after ~1.8s)
      await expect(dialog.getByText("You're all set!")).toBeVisible()
      await expect(dialog).not.toBeVisible({ timeout: 5_000 })

      // Verify persistence
      const completed = await mainWindow.evaluate(() => window.api.settings.get('onboarding_completed'))
      expect(completed).toBe('true')
    } finally {
      // Restore flag so subsequent tests never see the onboarding dialog
      await s.setSetting('onboarding_completed', 'true')
      await mainWindow.reload({ waitUntil: 'domcontentloaded' })
      await mainWindow.waitForSelector('#root', { timeout: 10_000 })
    }
  })
})
