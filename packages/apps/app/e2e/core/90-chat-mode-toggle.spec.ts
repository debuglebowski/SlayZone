import { test, expect, seed, goHome, clickProject, resetApp } from '../fixtures/electron'
import { TEST_PROJECT_PATH } from '../fixtures/electron'

/**
 * Chat-mode toggle UI test (no live claude spawn).
 *
 * Live transport is covered by unit tests:
 *   packages/domains/terminal/src/main/agents/claude-code-adapter.test.ts
 *   packages/domains/terminal/src/main/chat-transport-manager.test.ts
 *   packages/domains/terminal/src/client/chat-timeline.test.ts
 *
 * This spec covers the UI wiring: terminal context menu surfaces an "Enable
 * chat (beta)" item, the confirm dialog gates display-mode changes, and DB
 * persistence flips display_mode on confirm.
 */
test.describe('Chat-mode toggle', () => {
  let projectAbbrev: string
  let taskId: string

  const openTerminalMenu = async (mainWindow: import('@playwright/test').Page) => {
    const terminal = mainWindow.locator('.xterm-screen').first()
    await terminal.click({ button: 'right' })
  }

  test.beforeAll(async ({ mainWindow }) => {
    await resetApp(mainWindow)
    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'Chat Mode', color: '#8b5cf6', path: TEST_PROJECT_PATH })
    projectAbbrev = p.name.slice(0, 2).toUpperCase()

    const task = await s.createTask({ projectId: p.id, title: 'Chat toggle task', status: 'in_progress' })
    taskId = task.id
    // Force terminal_mode = claude-code so the chat toggle is offered.
    await mainWindow.evaluate(
      async (id) => window.api.db.updateTask({ id, terminalMode: 'claude-code' } as never),
      taskId
    )
    await s.refreshData()

    await goHome(mainWindow)
    await clickProject(mainWindow, projectAbbrev)
    await mainWindow.getByText('Chat toggle task').first().click()
    await expect(
      mainWindow.locator('[data-testid="terminal-mode-trigger"]:visible').first()
    ).toBeVisible({ timeout: 10_000 })
  })

  test('terminal context menu offers Enable chat (beta) for claude-code', async ({ mainWindow }) => {
    await openTerminalMenu(mainWindow)
    await expect(mainWindow.getByRole('menuitem', { name: /Enable chat \(beta\)/ })).toBeVisible({ timeout: 5_000 })
    // Close menu — Escape closes Radix context menus.
    await mainWindow.keyboard.press('Escape')
  })

  test('clicking Enable chat shows confirm dialog; cancel preserves xterm', async ({ mainWindow }) => {
    await openTerminalMenu(mainWindow)
    await mainWindow.getByRole('menuitem', { name: /Enable chat \(beta\)/ }).click()

    await expect(mainWindow.getByText('Enable chat view?')).toBeVisible({ timeout: 5_000 })
    await mainWindow.getByRole('button', { name: 'Cancel' }).click()
    await expect(mainWindow.getByText('Enable chat view?')).toBeHidden({ timeout: 2_000 })

    // DB still xterm
    const tabs = await mainWindow.evaluate(
      async (tid) => window.api.tabs.list(tid),
      taskId
    )
    const mainTab = tabs.find((t) => t.isMain)!
    expect(mainTab.displayMode).toBe('xterm')
  })

  test('confirming Enable chat flips displayMode to chat in DB', async ({ mainWindow }) => {
    await openTerminalMenu(mainWindow)
    await mainWindow.getByRole('menuitem', { name: /Enable chat \(beta\)/ }).click()

    await expect(mainWindow.getByText('Enable chat view?')).toBeVisible({ timeout: 5_000 })
    await mainWindow.getByRole('button', { name: 'Enable' }).click()
    await expect(mainWindow.getByText('Enable chat view?')).toBeHidden({ timeout: 2_000 })

    // DB updated
    await expect
      .poll(
        async () => {
          const tabs = await mainWindow.evaluate(
            async (tid) => window.api.tabs.list(tid),
            taskId
          )
          const mainTab = tabs.find((t) => t.isMain)
          return mainTab?.displayMode
        },
        { timeout: 5_000 }
      )
      .toBe('chat')
  })

  test('after switching, context menu offers Disable chat', async ({ mainWindow }) => {
    // In chat mode the pane renders ChatPanel — right-click on the chat
    // timeline scroll surface (where its ContextMenuTrigger is mounted).
    await mainWindow.locator('[data-panel-id="terminal"] .overflow-y-auto').first().click({ button: 'right', position: { x: 100, y: 100 } })
    await expect(mainWindow.getByRole('menuitem', { name: 'Disable chat', exact: true })).toBeVisible({ timeout: 5_000 })
    await mainWindow.keyboard.press('Escape')
  })
})
