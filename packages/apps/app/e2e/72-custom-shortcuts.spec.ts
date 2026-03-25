import { test, expect, seed, goHome, clickProject, resetApp } from './fixtures/electron'
import { TEST_PROJECT_PATH } from './fixtures/electron'

test.describe.serial('Custom keyboard shortcuts', () => {
  let projectAbbrev: string

  const openShortcutsDialog = async (mainWindow: import('@playwright/test').Page) => {
    await mainWindow.locator('button[aria-label="Keyboard Shortcuts"]').click()
    await expect(mainWindow.getByRole('dialog')).toBeVisible({ timeout: 3_000 })
  }

  const closeDialog = async (mainWindow: import('@playwright/test').Page) => {
    await mainWindow.keyboard.press('Escape')
    await expect(mainWindow.getByRole('dialog')).not.toBeVisible({ timeout: 3_000 })
  }

  const rebindShortcut = async (mainWindow: import('@playwright/test').Page, label: string, newKeys: string) => {
    await openShortcutsDialog(mainWindow)
    const labelSpan = mainWindow.getByRole('dialog').locator(`span.text-sm:text-is("${label}")`).first()
    const keyBadge = labelSpan.locator('..').locator('span.cursor-pointer')
    await keyBadge.click()
    await expect(mainWindow.getByText('Press keys...')).toBeVisible({ timeout: 2_000 })
    await mainWindow.keyboard.press(newKeys)
    await closeDialog(mainWindow)
  }

  const resetShortcuts = async (mainWindow: import('@playwright/test').Page) => {
    await openShortcutsDialog(mainWindow)
    await mainWindow.getByText('Reset to Defaults').click()
    await closeDialog(mainWindow)
  }

  test.beforeAll(async ({ mainWindow }) => {
    await resetApp(mainWindow)
    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'Shortcuts Test', color: '#06b6d4', path: TEST_PROJECT_PATH })
    projectAbbrev = p.name.slice(0, 2).toUpperCase()
    await s.createTask({ projectId: p.id, title: 'Shortcut task', status: 'in_progress' })
    await s.refreshData()
    await goHome(mainWindow)
    await clickProject(mainWindow, projectAbbrev)
    await expect(mainWindow.locator('h3').getByText('Inbox', { exact: true })).toBeVisible({ timeout: 5_000 })
  })

  // --- Basic dialog ---

  test('opens shortcuts dialog via sidebar button', async ({ mainWindow }) => {
    await openShortcutsDialog(mainWindow)
    await expect(mainWindow.getByRole('heading', { name: 'Keyboard Shortcuts' })).toBeVisible()
    await closeDialog(mainWindow)
  })

  // --- Rebinding ---

  test('rebind search shortcut — new key works, old key does not', async ({ mainWindow }) => {
    await rebindShortcut(mainWindow, 'Search', 'Meta+Shift+p')

    // New shortcut opens search
    await mainWindow.keyboard.press('Meta+Shift+p')
    await expect(mainWindow.getByPlaceholder('Search tasks and projects...')).toBeVisible({ timeout: 3_000 })
    await mainWindow.keyboard.press('Escape')

    // Old shortcut does NOT open search
    await mainWindow.keyboard.press('Meta+k')
    await mainWindow.waitForTimeout(500)
    await expect(mainWindow.getByPlaceholder('Search tasks and projects...')).not.toBeVisible()
  })

  test('reset to defaults restores original shortcuts', async ({ mainWindow }) => {
    await resetShortcuts(mainWindow)

    // Original Cmd+K works again
    await mainWindow.keyboard.press('Meta+k')
    await expect(mainWindow.getByPlaceholder('Search tasks and projects...')).toBeVisible({ timeout: 3_000 })
    await mainWindow.keyboard.press('Escape')
  })

  // --- Persistence ---

  test('shortcut persists after page reload', async ({ mainWindow }) => {
    await rebindShortcut(mainWindow, 'Search', 'Meta+Shift+p')

    await mainWindow.reload({ waitUntil: 'domcontentloaded' })
    await mainWindow.waitForSelector('#root', { timeout: 10_000 })
    await goHome(mainWindow)
    await clickProject(mainWindow, projectAbbrev)
    await expect(mainWindow.locator('h3').getByText('Inbox', { exact: true })).toBeVisible({ timeout: 5_000 })

    // Custom shortcut still works after reload
    await mainWindow.keyboard.press('Meta+Shift+p')
    await expect(mainWindow.getByPlaceholder('Search tasks and projects...')).toBeVisible({ timeout: 3_000 })
    await mainWindow.keyboard.press('Escape')

    await resetShortcuts(mainWindow)
  })

  // --- Conflict swap ---

  test('rebinding to conflicting key swaps both shortcuts', async ({ mainWindow }) => {
    // Rebind "New Task" (mod+n) to mod+k (which is "Search" default)
    await rebindShortcut(mainWindow, 'New Task', 'Meta+k')

    // Conflict dialog should appear — confirm reassign
    const reassignBtn = mainWindow.getByRole('dialog').getByText('Reassign')
    if (await reassignBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await reassignBtn.click()
      await closeDialog(mainWindow)
    }

    // Verify: mod+k now opens create task (not search)
    await mainWindow.keyboard.press('Meta+k')
    // The create task dialog should appear
    await mainWindow.waitForTimeout(500)
    const createDialog = mainWindow.getByRole('dialog')
    const hasCreate = await createDialog.getByText('Create Task').isVisible().catch(() => false)

    // Cleanup
    await mainWindow.keyboard.press('Escape')
    await resetShortcuts(mainWindow)

    expect(hasCreate).toBe(true)
  })

  // --- Non-customizable shortcuts still work ---

  test('non-customizable shortcuts (undo/redo) are not shown as editable', async ({ mainWindow }) => {
    await openShortcutsDialog(mainWindow)
    const undoRow = mainWindow.getByRole('dialog').locator(`span.text-sm:text-is("Undo")`).first()
    // Undo row should exist but its key badge should NOT have cursor-pointer
    await expect(undoRow).toBeVisible()
    const clickableBadge = undoRow.locator('..').locator('span.cursor-pointer')
    expect(await clickableBadge.count()).toBe(0)
    await closeDialog(mainWindow)
  })

  // --- Recording mode disables other shortcuts ---

  test('shortcuts do not fire during recording mode', async ({ mainWindow }) => {
    await openShortcutsDialog(mainWindow)
    // Start recording on Search row
    const labelSpan = mainWindow.getByRole('dialog').locator(`span.text-sm:text-is("Search")`).first()
    const keyBadge = labelSpan.locator('..').locator('span.cursor-pointer')
    await keyBadge.click()
    await expect(mainWindow.getByText('Press keys...')).toBeVisible({ timeout: 2_000 })

    // Press mod+n while recording — should NOT open create task dialog
    await mainWindow.keyboard.press('Meta+n')
    await mainWindow.waitForTimeout(300)

    // Cancel recording
    await mainWindow.keyboard.press('Escape')
    await closeDialog(mainWindow)

    // Verify no stray dialogs opened
    await expect(mainWindow.getByRole('dialog')).not.toBeVisible({ timeout: 1_000 })
  })

  // --- Menu accelerator updates ---

  test('rebinding updates Electron menu accelerators', async ({ mainWindow, electronApp }) => {
    // Rebind global settings from mod+, to mod+shift+;
    await rebindShortcut(mainWindow, 'Global Settings', 'Meta+Shift+;')

    // Send the old shortcut via IPC (simulates menu accelerator)
    // If menu updated correctly, mod+, should no longer trigger settings
    await mainWindow.keyboard.press('Meta+,')
    await mainWindow.waitForTimeout(500)
    // Settings dialog should NOT open (accelerator was updated)
    const settingsVisible = await mainWindow.getByRole('dialog').isVisible().catch(() => false)

    await resetShortcuts(mainWindow)

    // This test verifies the menu accelerator changed — if settings opened,
    // the before-input-event handler still has the old binding
    expect(settingsVisible).toBe(false)
  })
})
