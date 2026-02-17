import { test, expect, seed, goHome, clickProject } from './fixtures/electron'
import { TEST_PROJECT_PATH } from './fixtures/electron'

test.describe('Panel auto-split sizing', () => {
  let projectAbbrev: string

  const SETTINGS_DEFAULT = 440
  const HANDLE_WIDTH = 16
  const TOLERANCE = 8 // px tolerance for rounding/subpixel

  const openTaskViaSearch = async (
    page: import('@playwright/test').Page,
    title: string
  ) => {
    await page.keyboard.press('Meta+k')
    const input = page.getByPlaceholder('Search tasks and projects...')
    await expect(input).toBeVisible()
    await input.fill(title)
    await page.keyboard.press('Enter')
    await expect(page.locator('[data-testid="terminal-mode-trigger"]:visible').first()).toBeVisible({ timeout: 5_000 })
  }

  /** The split-view flex container */
  const splitContainer = (page: import('@playwright/test').Page) =>
    page.locator('.flex-1.flex.min-h-0.pb-4:visible').last()

  /** Get the container's content width */
  const getContainerWidth = async (page: import('@playwright/test').Page) => {
    const el = splitContainer(page)
    return el.evaluate((e) => e.getBoundingClientRect().width)
  }

  /** Get a panel's rendered width from bounding box (more reliable than style) */
  const getPanelBBox = async (
    page: import('@playwright/test').Page,
    locator: import('@playwright/test').Locator
  ) => {
    const box = await locator.boundingBox()
    expect(box).toBeTruthy()
    return box!.width
  }

  /** Settings panel */
  const settingsPanel = (page: import('@playwright/test').Page) =>
    page.getByTestId('task-settings-panel').last()

  /** Resize handles */
  const resizeHandles = (page: import('@playwright/test').Page) =>
    page.locator('[data-testid="panel-resize-handle"]:visible')

  /** Get all visible panel divs (direct children of split container, excluding handles) */
  const getVisiblePanelWidths = async (page: import('@playwright/test').Page) => {
    return splitContainer(page).evaluate((el) => {
      const widths: number[] = []
      for (const child of el.children) {
        const htmlEl = child as HTMLElement
        if (htmlEl.dataset.testid === 'panel-resize-handle') continue
        widths.push(htmlEl.getBoundingClientRect().width)
      }
      return widths
    })
  }

  /** Toggle a panel via keyboard shortcut */
  const togglePanel = async (
    page: import('@playwright/test').Page,
    key: string
  ) => {
    // Focus something safe first to avoid webview stealing keystrokes
    const input = page.locator('input:visible').first()
    if (await input.count()) await input.focus()
    await page.keyboard.press(`Meta+${key}`)
    // Wait for React re-render after panel toggle
    await expect(splitContainer(page)).toBeVisible()
  }

  /** Assert a width is close to expected value */
  const expectWidth = (actual: number, expected: number, msg?: string) => {
    expect(actual, msg).toBeGreaterThanOrEqual(expected - TOLERANCE)
    expect(actual, msg).toBeLessThanOrEqual(expected + TOLERANCE)
  }

  /** Seed old-format panel sizes to simulate pre-migration data */
  const seedOldPanelSizes = async (page: import('@playwright/test').Page, data: Record<string, unknown>) => {
    await page.evaluate(
      ([key, val]) => window.api.settings.set(key, val),
      ['taskDetailPanelSizes', JSON.stringify(data)] as const
    )
  }

  test.beforeAll(async ({ mainWindow }) => {
    const s = seed(mainWindow)
    const p = await s.createProject({
      name: 'AutoSplit',
      color: '#8b5cf6',
      path: TEST_PROJECT_PATH
    })
    projectAbbrev = p.name.slice(0, 2).toUpperCase()
    await s.createTask({
      projectId: p.id,
      title: 'Split sizing task',
      status: 'todo'
    })
    // Second task for migration tests (opening = fresh hook mount)
    await s.createTask({
      projectId: p.id,
      title: 'Migration task',
      status: 'todo'
    })
    await s.refreshData()

    // Clear persisted panel sizes
    await s.setSetting('taskDetailPanelSizes', '')

    await goHome(mainWindow)
    await clickProject(mainWindow, projectAbbrev)
    await expect(mainWindow.getByText('Split sizing task').first()).toBeVisible({ timeout: 5_000 })
    await openTaskViaSearch(mainWindow, 'Split sizing task')
  })

  // ── Migration: old format (no _v) produces equal auto-split ──

  test('migration: old format data produces equal auto-split on fresh task', async ({
    mainWindow
  }) => {
    // Seed old-format data (no _v, fixed widths for all panels)
    await seedOldPanelSizes(mainWindow, { browser: 400, gitDiff: 520, settings: 300, editor: 450 })

    // Open a DIFFERENT task (fresh usePanelSizes mount, picks up old data and migrates)
    await openTaskViaSearch(mainWindow, 'Migration task')

    // Enable browser so we can test equal split
    await togglePanel(mainWindow, 'b')

    const container = await getContainerWidth(mainWindow)
    const widths = await getVisiblePanelWidths(mainWindow)

    // DOM order: terminal(auto), browser(auto), settings(300 from old data)
    expect(widths).toHaveLength(3)

    const [terminalW, browserW, settingsW] = widths
    // Both auto panels should be equal (not one dominating)
    expectWidth(terminalW, browserW, 'terminal and browser should be equal')
    // Settings should be the old value (preserved during migration)
    expectWidth(settingsW, 300, 'settings preserved from old data')

    // Verify persisted data was migrated with _v
    const stored = await mainWindow.evaluate(() =>
      window.api.settings.get('taskDetailPanelSizes')
    )
    const parsed = JSON.parse(stored!)
    expect(parsed._v).toBe(4)
    expect(parsed.browser).toBe('auto')

    // Close browser, go back to main task
    const input = mainWindow.locator('input[placeholder="Enter URL..."]:visible')
    if (await input.count()) await input.first().focus()
    await togglePanel(mainWindow, 'b')
    await goHome(mainWindow)
    await clickProject(mainWindow, projectAbbrev)
    await expect(mainWindow.getByText('Split sizing task').first()).toBeVisible({ timeout: 5_000 })
  })

  // ── Clean state: reset for remaining tests ──

  test('setup: clear panel sizes for auto-split tests', async ({ mainWindow }) => {
    await mainWindow.evaluate(
      ([key, val]) => window.api.settings.set(key, val),
      ['taskDetailPanelSizes', ''] as const
    )
    await openTaskViaSearch(mainWindow, 'Split sizing task')
  })

  // ── Default state: terminal(auto) + settings(440) ─────────────
  // DOM order: terminal, settings

  test('default: terminal fills remaining space beside settings', async ({
    mainWindow
  }) => {
    const container = await getContainerWidth(mainWindow)
    const widths = await getVisiblePanelWidths(mainWindow)

    expect(widths).toHaveLength(2)

    const [terminalW, settingsW] = widths
    expectWidth(settingsW, SETTINGS_DEFAULT, 'settings should be default width')

    const expected = container - SETTINGS_DEFAULT - HANDLE_WIDTH
    expectWidth(terminalW, expected, 'terminal should fill remaining space')
  })

  // ── Toggle browser on: terminal(auto) + browser(auto) + settings(440) ──
  // DOM order: terminal, browser, settings

  test('toggle browser: two auto panels split equally', async ({
    mainWindow
  }) => {
    await togglePanel(mainWindow, 'b')

    const container = await getContainerWidth(mainWindow)
    const widths = await getVisiblePanelWidths(mainWindow)

    expect(widths).toHaveLength(3)

    const available = container - SETTINGS_DEFAULT - 2 * HANDLE_WIDTH
    const expectedAuto = available / 2

    const [terminalW, browserW, settingsW] = widths
    expectWidth(terminalW, expectedAuto, 'terminal auto width')
    expectWidth(browserW, expectedAuto, 'browser auto width')
    expectWidth(settingsW, SETTINGS_DEFAULT, 'settings fixed width')
  })

  // ── Toggle diff on: 3 auto panels + settings ──
  // DOM order: terminal, browser, diff, settings

  test('toggle diff: three auto panels split equally', async ({
    mainWindow
  }) => {
    await togglePanel(mainWindow, 'g')

    const container = await getContainerWidth(mainWindow)
    const widths = await getVisiblePanelWidths(mainWindow)

    expect(widths).toHaveLength(4)

    const available = container - SETTINGS_DEFAULT - 3 * HANDLE_WIDTH
    const expectedAuto = available / 3

    // DOM order: terminal, browser, diff, settings
    const [terminalW, browserW, diffW, settingsW] = widths
    expectWidth(terminalW, expectedAuto, 'terminal auto width')
    expectWidth(browserW, expectedAuto, 'browser auto width')
    expectWidth(diffW, expectedAuto, 'diff auto width')
    expectWidth(settingsW, SETTINGS_DEFAULT, 'settings fixed width')
  })

  // ── Toggle editor on: 4 auto panels + settings ──
  // DOM order: terminal, browser, editor, diff, settings

  test('toggle editor: four auto panels split equally', async ({
    mainWindow
  }) => {
    await togglePanel(mainWindow, 'e')

    const container = await getContainerWidth(mainWindow)
    const widths = await getVisiblePanelWidths(mainWindow)

    expect(widths).toHaveLength(5)

    const available = container - SETTINGS_DEFAULT - 4 * HANDLE_WIDTH
    const expectedAuto = available / 4

    // DOM order: terminal, browser, editor, diff, settings
    const [terminalW, browserW, editorW, diffW, settingsW] = widths
    expectWidth(terminalW, expectedAuto, 'terminal auto width')
    expectWidth(browserW, expectedAuto, 'browser auto width')
    expectWidth(editorW, expectedAuto, 'editor auto width')
    expectWidth(diffW, expectedAuto, 'diff auto width')
    expectWidth(settingsW, SETTINGS_DEFAULT, 'settings fixed width')
  })

  // ── Close panels back to terminal + settings, verify fill ──

  test('close editor + diff + browser: terminal fills space again', async ({
    mainWindow
  }) => {
    await togglePanel(mainWindow, 'e')
    await togglePanel(mainWindow, 'g')
    // Focus away from browser URL input before toggling browser
    const input = mainWindow.locator(
      'input[placeholder="Enter URL..."]:visible'
    )
    if (await input.count()) await input.first().focus()
    await togglePanel(mainWindow, 'b')

    const container = await getContainerWidth(mainWindow)
    const widths = await getVisiblePanelWidths(mainWindow)

    expect(widths).toHaveLength(2)
    const [terminalW, settingsW] = widths
    expectWidth(settingsW, SETTINGS_DEFAULT)
    expectWidth(terminalW, container - SETTINGS_DEFAULT - HANDLE_WIDTH)
  })

  // ── Drag to pin a panel, then verify it stays pinned ──

  test('drag resize pins browser, pin survives other toggles', async ({
    mainWindow
  }) => {
    // Open browser
    await togglePanel(mainWindow, 'b')

    // Find the first resize handle (terminal | browser)
    const handle = resizeHandles(mainWindow).first()
    const box = await handle.boundingBox()
    expect(box).toBeTruthy()

    // Drag left by 100px → browser gets wider
    await mainWindow.mouse.move(
      box!.x + box!.width / 2,
      box!.y + box!.height / 2
    )
    await mainWindow.mouse.down()
    await mainWindow.mouse.move(box!.x - 100, box!.y + box!.height / 2, {
      steps: 5
    })
    await mainWindow.mouse.up()

    // Wait for pinned width to persist
    await expect.poll(async () => {
      const s = await mainWindow.evaluate(() => window.api.settings.get('taskDetailPanelSizes'))
      return s ? typeof JSON.parse(s).browser : undefined
    }, { timeout: 5_000 }).toBe('number')

    // Read browser's pinned width
    const widths = await getVisiblePanelWidths(mainWindow)
    const pinnedBrowserW = widths[1]
    expect(pinnedBrowserW).toBeGreaterThan(200)

    // Verify it's stored as a number (pinned)
    const stored = await mainWindow.evaluate(() =>
      window.api.settings.get('taskDetailPanelSizes')
    )
    const parsed = JSON.parse(stored!)
    expect(typeof parsed.browser).toBe('number')

    // Toggle diff on — browser should stay pinned at same width
    await togglePanel(mainWindow, 'g')
    const widthsAfter = await getVisiblePanelWidths(mainWindow)
    // DOM order: terminal(auto), browser(pinned), diff(auto), settings(440)
    expectWidth(widthsAfter[1], pinnedBrowserW, 'browser stays pinned after diff toggle')

    // Clean up: close diff
    await togglePanel(mainWindow, 'g')
  })

  // ── Close and reopen pinned panel → resets to auto ──

  test('close and reopen pinned panel resets to auto', async ({
    mainWindow
  }) => {
    // Browser is currently pinned from previous test — close it
    const input = mainWindow.locator(
      'input[placeholder="Enter URL..."]:visible'
    )
    if (await input.count()) await input.first().focus()
    await togglePanel(mainWindow, 'b')

    // Reopen — should reset to auto
    await togglePanel(mainWindow, 'b')

    const container = await getContainerWidth(mainWindow)
    const available = container - SETTINGS_DEFAULT - 2 * HANDLE_WIDTH
    const expectedAuto = available / 2

    const widths = await getVisiblePanelWidths(mainWindow)
    expectWidth(widths[0], expectedAuto, 'terminal auto after reopen')
    expectWidth(widths[1], expectedAuto, 'browser auto after reopen')

    // Verify stored as 'auto' again
    const stored = await mainWindow.evaluate(() =>
      window.api.settings.get('taskDetailPanelSizes')
    )
    const parsed = JSON.parse(stored!)
    expect(parsed.browser).toBe('auto')
  })

  // ── Double-click resize handle resets panel to default ──

  test('double-click resize handle resets panel to default', async ({
    mainWindow
  }) => {
    // Pin browser by dragging
    const handle = resizeHandles(mainWindow).first()
    const box = await handle.boundingBox()
    expect(box).toBeTruthy()

    await mainWindow.mouse.move(
      box!.x + box!.width / 2,
      box!.y + box!.height / 2
    )
    await mainWindow.mouse.down()
    await mainWindow.mouse.move(box!.x - 150, box!.y + box!.height / 2, {
      steps: 5
    })
    await mainWindow.mouse.up()

    // Wait for pinned width to persist
    await expect.poll(async () => {
      const s = await mainWindow.evaluate(() => window.api.settings.get('taskDetailPanelSizes'))
      return s ? typeof JSON.parse(s).browser : undefined
    }, { timeout: 5_000 }).toBe('number')

    // Verify pinned
    let stored = await mainWindow.evaluate(() =>
      window.api.settings.get('taskDetailPanelSizes')
    )
    expect(typeof JSON.parse(stored!).browser).toBe('number')

    // Double-click to reset
    const box2 = await handle.boundingBox()
    await mainWindow.mouse.dblclick(
      box2!.x + box2!.width / 2,
      box2!.y + box2!.height / 2
    )

    // Wait for reset to persist
    await expect.poll(async () => {
      const s = await mainWindow.evaluate(() => window.api.settings.get('taskDetailPanelSizes'))
      return s ? JSON.parse(s).browser : undefined
    }, { timeout: 5_000 }).toBe('auto')

    // Should be auto again
    stored = await mainWindow.evaluate(() =>
      window.api.settings.get('taskDetailPanelSizes')
    )
    expect(JSON.parse(stored!).browser).toBe('auto')
  })

  // ── Double-click settings handle resets to 440 ──

  test('double-click settings handle resets to 440', async ({
    mainWindow
  }) => {
    // Find settings handle (second handle: browser | settings)
    const handle = resizeHandles(mainWindow).nth(1)
    const box = await handle.boundingBox()
    expect(box).toBeTruthy()

    // Drag to change settings width
    await mainWindow.mouse.move(
      box!.x + box!.width / 2,
      box!.y + box!.height / 2
    )
    await mainWindow.mouse.down()
    await mainWindow.mouse.move(box!.x - 60, box!.y + box!.height / 2, {
      steps: 5
    })
    await mainWindow.mouse.up()

    // Wait for settings width to be persisted as a number (pinned)
    await expect.poll(async () => {
      const s = await mainWindow.evaluate(() => window.api.settings.get('taskDetailPanelSizes'))
      return s ? typeof JSON.parse(s).settings : undefined
    }, { timeout: 5_000 }).toBe('number')

    const widthsBefore = await getVisiblePanelWidths(mainWindow)
    // DOM order: terminal, browser, settings — settings is index 2
    expect(widthsBefore[2]).not.toBe(SETTINGS_DEFAULT)

    // Double-click to reset
    const box2 = await handle.boundingBox()
    await mainWindow.mouse.dblclick(
      box2!.x + box2!.width / 2,
      box2!.y + box2!.height / 2
    )

    // Wait for settings to reset to default width
    await expect.poll(async () => {
      const widths = await getVisiblePanelWidths(mainWindow)
      return widths[2]
    }, { timeout: 5_000 }).toBeGreaterThanOrEqual(SETTINGS_DEFAULT - TOLERANCE)

    const widthsAfter = await getVisiblePanelWidths(mainWindow)
    expectWidth(widthsAfter[2], SETTINGS_DEFAULT, 'settings reset to default')
  })

  // ── Solo terminal fills entire container ──

  test('solo terminal fills entire container', async ({ mainWindow }) => {
    // Close browser + settings
    const input = mainWindow.locator(
      'input[placeholder="Enter URL..."]:visible'
    )
    if (await input.count()) await input.first().focus()
    await togglePanel(mainWindow, 'b')
    await togglePanel(mainWindow, 's')

    const container = await getContainerWidth(mainWindow)
    const widths = await getVisiblePanelWidths(mainWindow)

    expect(widths).toHaveLength(1)
    expectWidth(widths[0], container, 'solo terminal fills container')

    // Restore: settings back on
    await togglePanel(mainWindow, 's')
  })

  // ── Rapid toggle sequence doesn't break layout ──

  test('rapid toggle sequence: panels sum to container width', async ({
    mainWindow
  }) => {
    // Rapid toggles: browser on, diff on, browser off, editor on, diff off
    await togglePanel(mainWindow, 'b')
    await togglePanel(mainWindow, 'g')
    const input = mainWindow.locator(
      'input[placeholder="Enter URL..."]:visible'
    )
    if (await input.count()) await input.first().focus()
    await togglePanel(mainWindow, 'b')
    await togglePanel(mainWindow, 'e')
    await togglePanel(mainWindow, 'g')

    // State: terminal(auto) + editor(auto) + settings(440)
    // DOM order: terminal, editor, settings
    const container = await getContainerWidth(mainWindow)
    const widths = await getVisiblePanelWidths(mainWindow)

    expect(widths).toHaveLength(3) // terminal, editor, settings

    const handleCount = widths.length - 1
    const totalPanelWidth = widths.reduce((a, b) => a + b, 0)
    const totalWithHandles = totalPanelWidth + handleCount * HANDLE_WIDTH
    expectWidth(totalWithHandles, container, 'panels + handles = container')

    // Clean up: close editor
    await togglePanel(mainWindow, 'e')
  })

  // ── Auto panels are equal width (not one dominating) ──

  test('auto panels are truly equal, no panel dominates', async ({
    mainWindow
  }) => {
    // Open browser + diff + editor
    await togglePanel(mainWindow, 'b')
    await togglePanel(mainWindow, 'g')
    await togglePanel(mainWindow, 'e')

    const widths = await getVisiblePanelWidths(mainWindow)
    // DOM order: terminal, browser, editor, diff, settings
    expect(widths).toHaveLength(5)

    // All auto panels (indices 0,1,2,3) should be equal — settings is index 4
    const autoPanels = [widths[0], widths[1], widths[2], widths[3]]
    const avg = autoPanels.reduce((a, b) => a + b, 0) / autoPanels.length

    for (const w of autoPanels) {
      expectWidth(w, avg, `auto panel should be ~${Math.round(avg)}px`)
    }

    // No auto panel should be more than 2x any other
    const minAuto = Math.min(...autoPanels)
    const maxAuto = Math.max(...autoPanels)
    expect(maxAuto / minAuto).toBeLessThan(1.1) // within 10%

    // Clean up
    await togglePanel(mainWindow, 'e')
    await togglePanel(mainWindow, 'g')
    const input = mainWindow.locator(
      'input[placeholder="Enter URL..."]:visible'
    )
    if (await input.count()) await input.first().focus()
    await togglePanel(mainWindow, 'b')
  })
})
