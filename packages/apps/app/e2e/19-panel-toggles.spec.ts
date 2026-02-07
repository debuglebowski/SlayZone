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
    await mainWindow.waitForTimeout(500)

    // Open task detail
    await mainWindow.getByText('Panel toggle task').first().click()
    await mainWindow.waitForTimeout(500)
  })

  /** Scope to visible PanelToggle buttons in the active task tab */
  const panelBtn = (page: import('@playwright/test').Page, label: string) =>
    page.locator('.bg-muted.rounded-lg:visible').filter({ has: page.locator('button:has-text("Terminal")') }).locator(`button:has-text("${label}")`)

  test('default panels: terminal + settings active, browser + gitDiff inactive', async ({ mainWindow }) => {
    await expect(panelBtn(mainWindow, 'Terminal')).toHaveClass(/bg-background/)
    await expect(panelBtn(mainWindow, 'Settings')).toHaveClass(/bg-background/)
    await expect(panelBtn(mainWindow, 'Browser')).not.toHaveClass(/bg-background/)
    await expect(panelBtn(mainWindow, 'Git diff')).not.toHaveClass(/bg-background/)
  })

  test('Cmd+T toggles terminal off', async ({ mainWindow }) => {
    await mainWindow.keyboard.press('Meta+t')
    await mainWindow.waitForTimeout(300)
    await expect(panelBtn(mainWindow, 'Terminal')).not.toHaveClass(/bg-background/)
  })

  test('Cmd+B toggles browser on', async ({ mainWindow }) => {
    await mainWindow.keyboard.press('Meta+b')
    await mainWindow.waitForTimeout(300)
    await expect(panelBtn(mainWindow, 'Browser')).toHaveClass(/bg-background/)
  })

  test('Cmd+G toggles git diff on', async ({ mainWindow }) => {
    await mainWindow.keyboard.press('Meta+g')
    await mainWindow.waitForTimeout(300)
    await expect(panelBtn(mainWindow, 'Git diff')).toHaveClass(/bg-background/)
  })

  test('Cmd+S toggles settings off', async ({ mainWindow }) => {
    await mainWindow.keyboard.press('Meta+s')
    await mainWindow.waitForTimeout(300)
    await expect(panelBtn(mainWindow, 'Settings')).not.toHaveClass(/bg-background/)
  })

  test('click PanelToggle button toggles panel', async ({ mainWindow }) => {
    // Terminal is currently off — click to turn on
    await panelBtn(mainWindow, 'Terminal').click()
    await mainWindow.waitForTimeout(300)
    await expect(panelBtn(mainWindow, 'Terminal')).toHaveClass(/bg-background/)
  })

  test('panel visibility persists across navigation', async ({ mainWindow }) => {
    // Current state: terminal=on, browser=on, gitDiff=on, settings=off
    // Navigate away
    await goHome(mainWindow)
    await mainWindow.waitForTimeout(300)

    // Reopen the same task
    await clickProject(mainWindow, projectAbbrev)
    await mainWindow.waitForTimeout(300)
    await mainWindow.getByText('Panel toggle task').first().click()
    await mainWindow.waitForTimeout(500)

    // Verify persisted state
    await expect(panelBtn(mainWindow, 'Terminal')).toHaveClass(/bg-background/)
    await expect(panelBtn(mainWindow, 'Browser')).toHaveClass(/bg-background/)
    await expect(panelBtn(mainWindow, 'Git diff')).toHaveClass(/bg-background/)
    await expect(panelBtn(mainWindow, 'Settings')).not.toHaveClass(/bg-background/)
  })
})
