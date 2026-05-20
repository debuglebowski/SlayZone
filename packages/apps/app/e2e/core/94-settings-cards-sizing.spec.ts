import {
  test,
  expect,
  seed,
  goHome,
  clickProject,
  resetApp,
  TEST_PROJECT_PATH
} from '../fixtures/electron'
import type { Page, Locator, ElectronApplication } from '@playwright/test'

// --- Helpers ---

const settingsPanel = (page: Page): Locator => page.getByTestId('task-settings-panel').last()

const descriptionCard = (page: Page): Locator =>
  settingsPanel(page).getByTestId('settings-description-card')

const subtasksCard = (page: Page): Locator =>
  settingsPanel(page).getByTestId('settings-subtasks-card')

const artifactsCard = (page: Page): Locator =>
  settingsPanel(page).getByTestId('settings-artifacts-card')

const cardsGrid = (page: Page): Locator => settingsPanel(page).getByTestId('settings-cards-grid')

async function cardHeight(locator: Locator): Promise<number> {
  const box = await locator.boundingBox()
  return box?.height ?? 0
}

async function cardState(locator: Locator): Promise<'open' | 'closed'> {
  const state = await locator.getAttribute('data-state')
  return state === 'open' ? 'open' : 'closed'
}

async function setCardOpen(card: Locator, open: boolean) {
  const current = await cardState(card)
  const want = open ? 'open' : 'closed'
  if (current === want) return
  await card.locator('button').first().click()
  await expect(card).toHaveAttribute('data-state', want, { timeout: 2_000 })
}

async function createSubtasks(page: Page, parentId: string, projectId: string, count: number) {
  await page.evaluate(
    async ({ parentId, projectId, count }) => {
      for (let i = 0; i < count; i += 1) {
        await window.api.db.createTask({
          projectId,
          parentId,
          title: `Subtask ${i + 1}`,
          status: 'todo'
        })
      }
    },
    { parentId, projectId, count }
  )
  await page.evaluate(async () => {
    await (
      window as unknown as { __slayzone_refreshData?: () => Promise<void> }
    ).__slayzone_refreshData?.()
    await new Promise((r) => setTimeout(r, 100))
  })
}

async function clearSubtasks(page: Page, parentId: string) {
  await page.evaluate(async (pid) => {
    const subs = await window.api.db.getSubTasks(pid)
    for (const s of subs) await window.api.db.deleteTask(s.id)
  }, parentId)
  await page.evaluate(async () => {
    await (
      window as unknown as { __slayzone_refreshData?: () => Promise<void> }
    ).__slayzone_refreshData?.()
    await new Promise((r) => setTimeout(r, 100))
  })
}

async function resizeWindow(electronApp: ElectronApplication, width: number, height: number) {
  await electronApp.evaluate(
    ({ BrowserWindow }, size) => {
      const win = BrowserWindow.getAllWindows().find(
        (w) =>
          !w.isDestroyed() &&
          w.webContents.getURL() !== 'about:blank' &&
          !w.webContents.getURL().startsWith('data:')
      )
      if (win) {
        win.setSize(size.width, size.height)
        win.center()
      }
    },
    { width, height }
  )
}

// --- Tests ---

test.describe('Settings panel card sizing', () => {
  let projectAbbrev: string
  let projectId: string
  let taskId: string

  test.beforeAll(async ({ mainWindow }) => {
    await resetApp(mainWindow)
    const s = seed(mainWindow)
    const p = await s.createProject({
      name: 'CardSize Test',
      color: '#6366f1',
      path: TEST_PROJECT_PATH
    })
    projectId = p.id
    projectAbbrev = p.name.slice(0, 2).toUpperCase()
    const t = await s.createTask({ projectId: p.id, title: 'Card sizing task', status: 'todo' })
    taskId = t.id
    await s.refreshData()

    await goHome(mainWindow)
    await clickProject(mainWindow, projectAbbrev)
    await expect(mainWindow.getByText('Card sizing task').first()).toBeVisible({ timeout: 5_000 })
    await mainWindow.getByText('Card sizing task').first().click()
    await expect(settingsPanel(mainWindow)).toBeVisible({ timeout: 5_000 })
  })

  test.beforeEach(async ({ mainWindow }) => {
    // Reset state: clear subtasks, ensure cards start in known state
    await clearSubtasks(mainWindow, taskId)
  })

  test('all cards closed: each card is roughly header-height', async ({ mainWindow }) => {
    await setCardOpen(descriptionCard(mainWindow), false)
    await setCardOpen(subtasksCard(mainWindow), false)
    await setCardOpen(artifactsCard(mainWindow), false)

    expect(await cardHeight(descriptionCard(mainWindow))).toBeLessThan(60)
    expect(await cardHeight(subtasksCard(mainWindow))).toBeLessThan(60)
    expect(await cardHeight(artifactsCard(mainWindow))).toBeLessThan(60)
  })

  test('only subtasks open + 0 subtasks: subtasks card is small (content-sized)', async ({
    mainWindow
  }) => {
    await setCardOpen(descriptionCard(mainWindow), false)
    await setCardOpen(subtasksCard(mainWindow), true)
    await setCardOpen(artifactsCard(mainWindow), false)

    // Just header + "Add subtask" button
    expect(await cardHeight(subtasksCard(mainWindow))).toBeLessThan(120)
    // Closed peers stay small
    expect(await cardHeight(descriptionCard(mainWindow))).toBeLessThan(60)
    expect(await cardHeight(artifactsCard(mainWindow))).toBeLessThan(60)
  })

  test('only subtasks open + 25 subtasks: card caps at share, does not overflow grid', async ({
    mainWindow
  }) => {
    await createSubtasks(mainWindow, taskId, projectId, 25)
    await setCardOpen(descriptionCard(mainWindow), false)
    await setCardOpen(subtasksCard(mainWindow), true)
    await setCardOpen(artifactsCard(mainWindow), false)

    const gridH = await cardHeight(cardsGrid(mainWindow))
    const subH = await cardHeight(subtasksCard(mainWindow))

    // Card should be substantial (much more than header-only)
    expect(subH).toBeGreaterThan(150)
    // Card should not exceed grid height
    expect(subH).toBeLessThanOrEqual(gridH + 1)
  })

  test('all open + 25 subtasks: subtasks caps, description + artifacts stay content-sized', async ({
    mainWindow
  }) => {
    await createSubtasks(mainWindow, taskId, projectId, 25)
    await setCardOpen(descriptionCard(mainWindow), true)
    await setCardOpen(subtasksCard(mainWindow), true)
    await setCardOpen(artifactsCard(mainWindow), true)

    const descH = await cardHeight(descriptionCard(mainWindow))
    const subH = await cardHeight(subtasksCard(mainWindow))
    const artifactsH = await cardHeight(artifactsCard(mainWindow))

    // Subtasks should be much bigger than both other cards
    expect(subH).toBeGreaterThan(descH)
    expect(subH).toBeGreaterThan(artifactsH)
    // Description + artifacts stay small (content-sized — empty editor + "Add artifact" button)
    expect(artifactsH).toBeLessThan(120)
  })

  test('all open + empty: cards are content-sized, total < grid', async ({ mainWindow }) => {
    await setCardOpen(descriptionCard(mainWindow), true)
    await setCardOpen(subtasksCard(mainWindow), true)
    await setCardOpen(artifactsCard(mainWindow), true)

    const gridH = await cardHeight(cardsGrid(mainWindow))
    const descH = await cardHeight(descriptionCard(mainWindow))
    const subH = await cardHeight(subtasksCard(mainWindow))
    const artifactsH = await cardHeight(artifactsCard(mainWindow))

    // Three small cards + two gaps should be well under grid height (leftover at bottom)
    const total = descH + subH + artifactsH + 32 // 2 × 16px gap
    expect(total).toBeLessThan(gridH - 50)
  })

  test('only description open: description content-sized, peers tiny', async ({ mainWindow }) => {
    await setCardOpen(descriptionCard(mainWindow), true)
    await setCardOpen(subtasksCard(mainWindow), false)
    await setCardOpen(artifactsCard(mainWindow), false)

    const descH = await cardHeight(descriptionCard(mainWindow))
    const gridH = await cardHeight(cardsGrid(mainWindow))

    // Empty description editor: small, not filling entire grid
    expect(descH).toBeLessThan(gridH - 100)
    expect(await cardHeight(subtasksCard(mainWindow))).toBeLessThan(60)
    expect(await cardHeight(artifactsCard(mainWindow))).toBeLessThan(60)
  })

  test('only artifacts open: artifacts content-sized, peers tiny', async ({ mainWindow }) => {
    await setCardOpen(descriptionCard(mainWindow), false)
    await setCardOpen(subtasksCard(mainWindow), false)
    await setCardOpen(artifactsCard(mainWindow), true)

    const artifactsH = await cardHeight(artifactsCard(mainWindow))
    const gridH = await cardHeight(cardsGrid(mainWindow))

    // Empty artifacts: small, not filling
    expect(artifactsH).toBeLessThan(gridH - 100)
    expect(await cardHeight(descriptionCard(mainWindow))).toBeLessThan(60)
    expect(await cardHeight(subtasksCard(mainWindow))).toBeLessThan(60)
  })

  test('toggle subtasks closed with 25 subtasks: collapses back to header', async ({
    mainWindow
  }) => {
    await createSubtasks(mainWindow, taskId, projectId, 25)
    await setCardOpen(subtasksCard(mainWindow), true)
    const openH = await cardHeight(subtasksCard(mainWindow))
    expect(openH).toBeGreaterThan(150)

    await setCardOpen(subtasksCard(mainWindow), false)
    expect(await cardHeight(subtasksCard(mainWindow))).toBeLessThan(60)
  })

  test('short window: open card with content stays visible, panel scrolls (regression)', async ({
    mainWindow,
    electronApp
  }) => {
    // Regression: a short panel used to starve the cards grid (flex-1) — the
    // fit-content `share` calc went ~0/negative and open cards clipped to
    // header-only. Open cards holding content must stay visible; the panel
    // degrades by scrolling instead.
    await createSubtasks(mainWindow, taskId, projectId, 6)
    await setCardOpen(descriptionCard(mainWindow), true)
    await setCardOpen(subtasksCard(mainWindow), true)
    await setCardOpen(artifactsCard(mainWindow), true)

    await resizeWindow(electronApp, 1100, 500)
    await mainWindow.waitForTimeout(300)

    // Sub-tasks card has 6 items — must not clip to header-only
    expect(await cardHeight(subtasksCard(mainWindow))).toBeGreaterThan(60)

    // Panel degrades by scrolling, not clipping
    const scrollable = await settingsPanel(mainWindow).evaluate(
      (el) => el.scrollHeight > el.clientHeight
    )
    expect(scrollable).toBe(true)

    await resizeWindow(electronApp, 1920, 1200)
  })

  test.afterAll(async ({ electronApp }) => {
    await resizeWindow(electronApp, 1920, 1200)
  })

  test('description full-height mode: sub-tasks + artifacts still expandable', async ({
    mainWindow
  }) => {
    // Repro: after toggling Description "Full height", the handler force-closes
    // sub-tasks/artifacts. Clicking their headers must still re-open them.
    await setCardOpen(descriptionCard(mainWindow), true)
    await setCardOpen(subtasksCard(mainWindow), true)
    await setCardOpen(artifactsCard(mainWindow), true)

    // Enter full-height mode (force-closes sub-tasks + artifacts)
    await settingsPanel(mainWindow).getByRole('button', { name: 'Full height' }).click()
    await expect(subtasksCard(mainWindow)).toHaveAttribute('data-state', 'closed')
    await expect(artifactsCard(mainWindow)).toHaveAttribute('data-state', 'closed')

    // User clicks the headers — they must expand
    await setCardOpen(subtasksCard(mainWindow), true)
    await setCardOpen(artifactsCard(mainWindow), true)
    expect(await cardHeight(subtasksCard(mainWindow))).toBeGreaterThan(60)
    expect(await cardHeight(artifactsCard(mainWindow))).toBeGreaterThan(60)

    // Restore default height for later tests
    await settingsPanel(mainWindow).getByRole('button', { name: 'Default height' }).click()
  })

  test('full-height mode: Description fills space, opened peers stay capped', async ({
    mainWindow
  }) => {
    await createSubtasks(mainWindow, taskId, projectId, 25)
    await setCardOpen(descriptionCard(mainWindow), true)
    await setCardOpen(subtasksCard(mainWindow), false)
    await setCardOpen(artifactsCard(mainWindow), false)

    await settingsPanel(mainWindow).getByRole('button', { name: 'Full height' }).click()

    // Description fills available space — far taller than the collapsed peers
    expect(await cardHeight(descriptionCard(mainWindow))).toBeGreaterThan(300)

    // Open sub-tasks (25 items): must cap (fit-content(18rem)), not run away
    await setCardOpen(subtasksCard(mainWindow), true)
    const subH = await cardHeight(subtasksCard(mainWindow))
    expect(subH).toBeGreaterThan(60)
    expect(subH).toBeLessThanOrEqual(18 * 16 + 2)

    // Description still dominates
    expect(await cardHeight(descriptionCard(mainWindow))).toBeGreaterThan(subH)

    await settingsPanel(mainWindow).getByRole('button', { name: 'Default height' }).click()
  })

  test('clicking anywhere on a card header toggles it (not just the chevron)', async ({
    mainWindow
  }) => {
    // Repro: the CollapsibleTrigger only covered the chevron + label, leaving
    // the rest of the header row as dead space — clicking there did nothing.
    await setCardOpen(subtasksCard(mainWindow), false)
    await setCardOpen(artifactsCard(mainWindow), false)

    for (const card of [subtasksCard(mainWindow), artifactsCard(mainWindow)]) {
      const header = card.locator('[data-slot="collapsible-trigger"]').first()
      const box = await header.boundingBox()
      if (!box) throw new Error('no header box')
      // The header trigger must span the full row width — clicking its
      // far-right edge (dead space in the old layout) must toggle the card.
      expect(box.width).toBeGreaterThan(200)
      await mainWindow.mouse.click(box.x + box.width - 16, box.y + box.height / 2)
      await expect(card).toHaveAttribute('data-state', 'open', { timeout: 2_000 })
    }
  })

  test('cards grid total does not exceed panel height', async ({ mainWindow }) => {
    await createSubtasks(mainWindow, taskId, projectId, 25)
    await setCardOpen(descriptionCard(mainWindow), true)
    await setCardOpen(subtasksCard(mainWindow), true)
    await setCardOpen(artifactsCard(mainWindow), true)

    const panel = settingsPanel(mainWindow)
    const panelH = await cardHeight(panel)
    const gridH = await cardHeight(cardsGrid(mainWindow))

    // Grid always fits within its panel parent
    expect(gridH).toBeLessThanOrEqual(panelH + 1)
  })
})
