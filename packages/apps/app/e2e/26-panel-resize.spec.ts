import { test, expect, seed, goHome, clickProject } from './fixtures/electron'
import { TEST_PROJECT_PATH } from './fixtures/electron'

test.describe('Panel resize', () => {
  let projectAbbrev: string

  test.beforeAll(async ({ mainWindow }) => {
    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'Resize Test', color: '#f97316', path: TEST_PROJECT_PATH })
    projectAbbrev = p.name.slice(0, 2).toUpperCase()
    await s.createTask({ projectId: p.id, title: 'Resize task', status: 'todo' })
    await s.refreshData()

    // Clear any persisted panel sizes from previous test runs
    await s.setSetting('taskDetailPanelSizes', '')

    await goHome(mainWindow)
    await clickProject(mainWindow, projectAbbrev)
    await mainWindow.waitForTimeout(500)

    // Open task detail
    await mainWindow.getByText('Resize task').first().click()
    await mainWindow.waitForTimeout(500)
  })

  /** All resize handles (1px dividers with cursor-col-resize) */
  const resizeHandles = (page: import('@playwright/test').Page) =>
    page.locator('.cursor-col-resize')

  /** The settings panel (visible by default, uses inline width style) */
  const settingsPanel = (page: import('@playwright/test').Page) =>
    page.locator('div.shrink-0.border-l.overflow-y-auto')

  test('settings panel has default width of 320px', async ({ mainWindow }) => {
    const panel = settingsPanel(mainWindow)
    await expect(panel).toBeVisible()
    const width = await panel.evaluate(el => el.style.width)
    expect(width).toBe('320px')
  })

  test('resize handle visible between terminal and settings', async ({ mainWindow }) => {
    // With terminal + settings visible (default), there's 1 resize handle
    const handles = resizeHandles(mainWindow)
    await expect(handles.first()).toBeVisible()
  })

  test('drag resize handle to make settings panel wider', async ({ mainWindow }) => {
    const handle = resizeHandles(mainWindow).first()
    const box = await handle.boundingBox()
    expect(box).toBeTruthy()

    // Drag left by 80px → panel gets wider (startWidth - delta, delta is negative)
    await mainWindow.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
    await mainWindow.mouse.down()
    await mainWindow.mouse.move(box!.x - 80, box!.y + box!.height / 2, { steps: 5 })
    await mainWindow.mouse.up()
    await mainWindow.waitForTimeout(300)

    // Settings panel should now be ~400px (320 + 80)
    const width = await settingsPanel(mainWindow).evaluate(el => parseInt(el.style.width))
    expect(width).toBeGreaterThanOrEqual(380)
    expect(width).toBeLessThanOrEqual(420)
  })

  test('resize persists to settings DB', async ({ mainWindow }) => {
    const stored = await mainWindow.evaluate(() =>
      window.api.settings.get('taskDetailPanelSizes')
    )
    expect(stored).toBeTruthy()
    const parsed = JSON.parse(stored!)
    expect(parsed.settings).toBeGreaterThanOrEqual(380)
  })

  test('min width enforced', async ({ mainWindow }) => {
    const handle = resizeHandles(mainWindow).first()
    const box = await handle.boundingBox()
    expect(box).toBeTruthy()

    // Drag right by 500px → would make panel negative, but min is 200
    await mainWindow.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
    await mainWindow.mouse.down()
    await mainWindow.mouse.move(box!.x + 500, box!.y + box!.height / 2, { steps: 5 })
    await mainWindow.mouse.up()
    await mainWindow.waitForTimeout(300)

    const width = await settingsPanel(mainWindow).evaluate(el => parseInt(el.style.width))
    expect(width).toBe(200)
  })

  test('resize persists across navigation', async ({ mainWindow }) => {
    // Navigate away
    await goHome(mainWindow)
    await mainWindow.waitForTimeout(300)

    // Come back
    await clickProject(mainWindow, projectAbbrev)
    await mainWindow.waitForTimeout(300)
    await mainWindow.getByText('Resize task').first().click()
    await mainWindow.waitForTimeout(500)

    // Settings panel should still be 200px (the min we dragged to)
    const width = await settingsPanel(mainWindow).evaluate(el => parseInt(el.style.width))
    expect(width).toBe(200)
  })

  test('additional resize handles appear when more panels toggled', async ({ mainWindow }) => {
    // Currently: terminal + settings = 1 handle
    const handlesBefore = await resizeHandles(mainWindow).count()

    // Toggle browser on → adds terminal|browser handle
    await mainWindow.keyboard.press('Meta+b')
    await mainWindow.waitForTimeout(300)

    const handlesAfter = await resizeHandles(mainWindow).count()
    expect(handlesAfter).toBeGreaterThan(handlesBefore)

    // Toggle browser off to restore state
    // Focus URL input first to avoid webview stealing keystroke
    await mainWindow.locator('input[placeholder="Enter URL..."]').focus()
    await mainWindow.waitForTimeout(100)
    await mainWindow.keyboard.press('Meta+b')
    await mainWindow.waitForTimeout(300)
  })
})
