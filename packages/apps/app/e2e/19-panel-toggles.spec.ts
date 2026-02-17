import { test, expect, seed, goHome, clickProject } from './fixtures/electron'
import { TEST_PROJECT_PATH } from './fixtures/electron'

test.describe('Panel toggles', () => {
  let projectAbbrev: string
  let taskId: string

  test.beforeAll(async ({ mainWindow }) => {
    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'Panel Test', color: '#3b82f6', path: TEST_PROJECT_PATH })
    projectAbbrev = p.name.slice(0, 2).toUpperCase()
    const t = await s.createTask({ projectId: p.id, title: 'Panel toggle task', status: 'todo' })
    taskId = t.id
    await s.refreshData()

    await goHome(mainWindow)
    await clickProject(mainWindow, projectAbbrev)
    await expect(mainWindow.getByText('Panel toggle task').first()).toBeVisible({ timeout: 5_000 })

    // Open task detail
    await mainWindow.getByText('Panel toggle task').first().click()
    await expect(panelBtn(mainWindow, 'Terminal')).toBeVisible({ timeout: 5_000 })
  })

  /** Scope to visible PanelToggle buttons in the active task tab */
  const panelBtn = (page: import('@playwright/test').Page, label: string) =>
    page.locator('.bg-surface-2.rounded-lg:visible').filter({ has: page.locator('button:has-text("Terminal")') }).locator(`button:has-text("${label}")`)

  test('default panels: terminal + settings active, browser + diff inactive', async ({ mainWindow }) => {
    await expect(panelBtn(mainWindow, 'Terminal')).toHaveClass(/bg-muted/)
    await expect(panelBtn(mainWindow, 'Settings')).toHaveClass(/bg-muted/)
    await expect(panelBtn(mainWindow, 'Browser')).not.toHaveClass(/(?:^|\s)bg-muted(?:\s|$)/)
    await expect(panelBtn(mainWindow, 'Git')).not.toHaveClass(/(?:^|\s)bg-muted(?:\s|$)/)
  })

  test('Cmd+T toggles terminal off', async ({ mainWindow }) => {
    await mainWindow.keyboard.press('Meta+t')
    await expect(panelBtn(mainWindow, 'Terminal')).not.toHaveClass(/(?:^|\s)bg-muted(?:\s|$)/)
  })

  test('Cmd+B toggles browser on', async ({ mainWindow }) => {
    await mainWindow.keyboard.press('Meta+b')
    await expect(panelBtn(mainWindow, 'Browser')).toHaveClass(/bg-muted/)
  })

  test('Cmd+G toggles diff on', async ({ mainWindow }) => {
    await mainWindow.keyboard.press('Meta+g')
    await expect(panelBtn(mainWindow, 'Git')).toHaveClass(/bg-muted/)
  })

  test('Cmd+S toggles settings off', async ({ mainWindow }) => {
    await mainWindow.keyboard.press('Meta+s')
    await expect(panelBtn(mainWindow, 'Settings')).not.toHaveClass(/(?:^|\s)bg-muted(?:\s|$)/)
  })

  test('click PanelToggle button toggles panel', async ({ mainWindow }) => {
    // Terminal is currently off — click to turn on
    await panelBtn(mainWindow, 'Terminal').click()
    await expect(panelBtn(mainWindow, 'Terminal')).toHaveClass(/bg-muted/)
  })

  test('panel visibility persists across navigation', async ({ mainWindow }) => {
    // Current state: terminal=on, browser=on, diff=on, settings=off
    // Navigate away
    await goHome(mainWindow)

    // Reopen the same task
    await clickProject(mainWindow, projectAbbrev)
    await expect(mainWindow.getByText('Panel toggle task').first()).toBeVisible({ timeout: 5_000 })
    await mainWindow.getByText('Panel toggle task').first().click()
    await expect(panelBtn(mainWindow, 'Terminal')).toBeVisible({ timeout: 5_000 })

    // Verify persisted state
    await expect(panelBtn(mainWindow, 'Terminal')).toHaveClass(/bg-muted/)
    await expect(panelBtn(mainWindow, 'Browser')).toHaveClass(/bg-muted/)
    await expect(panelBtn(mainWindow, 'Git')).toHaveClass(/bg-muted/)
    await expect(panelBtn(mainWindow, 'Settings')).not.toHaveClass(/(?:^|\s)bg-muted(?:\s|$)/)
  })
})
