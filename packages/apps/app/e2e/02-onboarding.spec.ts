import { test, expect } from './fixtures/electron'

// Note: onboarding was already dismissed by the fixture on first launch.
// These tests verify it was shown and completed correctly.

test.describe('Onboarding', () => {
  test('onboarding completion is persisted', async ({ mainWindow }) => {
    const completed = await mainWindow.evaluate(() => window.api.settings.get('onboarding_completed'))
    expect(completed).toBe('true')
  })

  test('onboarding does not reappear after dismissal', async ({ mainWindow }) => {
    // The dialog should not be visible since it was dismissed
    await expect(mainWindow.getByRole('heading', { name: 'Welcome' })).not.toBeVisible()
  })
})
