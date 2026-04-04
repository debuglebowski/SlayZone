import { test, expect, resetApp } from '../fixtures/electron'

test.describe('App launch', () => {
  test.beforeEach(async ({ mainWindow }) => {
    await resetApp(mainWindow)
  })

  test('shows main window with empty state', async ({ mainWindow }) => {
    await expect(mainWindow.getByText(/create a project/i)).toBeVisible({ timeout: 10_000 })
  })

  test('main process has correct app name', async ({ electronApp }) => {
    const appName = await electronApp.evaluate(async ({ app }) => app.name)
    expect(appName).toBe('slayzone')
  })

  test('does not create splash window in Playwright mode', async ({ electronApp }) => {
    const dataWindows = electronApp.windows().filter((w) => w.url().startsWith('data:'))
    expect(dataWindows).toHaveLength(0)
  })
})
