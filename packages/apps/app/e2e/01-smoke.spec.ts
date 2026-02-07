import { test, expect } from './fixtures/electron'

test.describe('App launch', () => {
  test('shows main window with empty state', async ({ mainWindow }) => {
    await expect(mainWindow.getByText('create a project')).toBeVisible({ timeout: 10_000 })
  })

  test('main process has correct app name', async ({ electronApp }) => {
    const appName = await electronApp.evaluate(async ({ app }) => app.name)
    expect(appName).toBe('slayzone')
  })

  test('splash window closes after transition', async ({ electronApp }) => {
    // Splash has 4s min duration + 300ms fade + margin
    await new Promise((r) => setTimeout(r, 6_000))
    const dataWindows = electronApp.windows().filter((w) => w.url().startsWith('data:'))
    expect(dataWindows).toHaveLength(0)
  })
})
