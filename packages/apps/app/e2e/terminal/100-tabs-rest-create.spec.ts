import { test, expect, seed, resetApp, TEST_PROJECT_PATH } from '../fixtures/electron'
import { openTaskTerminal, waitForPtySession } from '../fixtures/terminal'

/**
 * `POST /api/tabs/create` and `POST /api/tabs/split` (CLI: `slay pty create` /
 * `slay pty split`) must:
 *   1. Insert a `terminal_tabs` row
 *   2. Auto-open the task tab (so TerminalContainer mounts → PTY spawns)
 *   3. Broadcast `tabs:changed` so any other window refreshes
 *   4. Return `{ tab, sessionId }` whose sessionId appears in `/api/pty`
 */
test.describe('Tab create/split via REST', () => {
  let projectAbbrev: string
  let projectId: string
  let mcpPort = 0

  test.beforeAll(async ({ electronApp, mainWindow }) => {
    await resetApp(mainWindow)
    mcpPort = await electronApp.evaluate(async () => {
      for (let i = 0; i < 20; i++) {
        const p = (globalThis as Record<string, unknown>).__mcpPort
        if (p) return p as number
        await new Promise((r) => setTimeout(r, 250))
      }
      return 0
    })
    expect(mcpPort).toBeTruthy()

    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'Tabs REST', color: '#10b981', path: TEST_PROJECT_PATH })
    projectId = p.id
    projectAbbrev = p.name.slice(0, 2).toUpperCase()
  })

  test('REST 400 when taskId missing', async ({ mainWindow }) => {
    const res = await mainWindow.evaluate(async ({ port }) => {
      const r = await fetch(`http://127.0.0.1:${port}/api/tabs/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      return { status: r.status }
    }, { port: mcpPort })
    expect(res.status).toBe(400)
  })

  test('REST 404 when task does not exist', async ({ mainWindow }) => {
    const res = await mainWindow.evaluate(async ({ port }) => {
      const r = await fetch(`http://127.0.0.1:${port}/api/tabs/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: '00000000-0000-0000-0000-000000000000' })
      })
      return { status: r.status }
    }, { port: mcpPort })
    expect(res.status).toBe(404)
  })

  test('create inserts tab row + spawns PTY when task is open', async ({ mainWindow }) => {
    const s = seed(mainWindow)
    const task = await s.createTask({ projectId, title: 'Tabs create spawn', status: 'in_progress' })
    await mainWindow.evaluate((id) => window.api.db.updateTask({ id, terminalMode: 'terminal' }), task.id)
    await s.refreshData()

    // Open task so TerminalContainer is mounted and listens for tabs:changed.
    await openTaskTerminal(mainWindow, { projectAbbrev, taskTitle: 'Tabs create spawn' })

    const result = await mainWindow.evaluate(async ({ taskId, port }) => {
      const r = await fetch(`http://127.0.0.1:${port}/api/tabs/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, mode: 'terminal', label: 'CLI tab' })
      })
      return r.json() as Promise<{ tab: { id: string; label: string; mode: string }; sessionId: string }>
    }, { taskId: task.id, port: mcpPort })

    expect(result.tab.label).toBe('CLI tab')
    expect(result.tab.mode).toBe('terminal')
    expect(result.sessionId).toBe(`${task.id}:${result.tab.id}`)

    // tabs:changed broadcast → renderer refetches → activeGroupId switches to
    // the new tab → TerminalSplitGroup mounts pane → PTY spawns.
    await waitForPtySession(mainWindow, result.sessionId)
  })

  test('split adds pane in same group', async ({ mainWindow }) => {
    const s = seed(mainWindow)
    const task = await s.createTask({ projectId, title: 'Tabs split spawn', status: 'in_progress' })
    await mainWindow.evaluate((id) => window.api.db.updateTask({ id, terminalMode: 'terminal' }), task.id)
    await s.refreshData()

    await openTaskTerminal(mainWindow, { projectAbbrev, taskTitle: 'Tabs split spawn' })

    // First create a non-main tab to split off of.
    const firstResult = await mainWindow.evaluate(async ({ taskId, port }) => {
      const r = await fetch(`http://127.0.0.1:${port}/api/tabs/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, mode: 'terminal' })
      })
      return r.json() as Promise<{ tab: { id: string; groupId: string }; sessionId: string }>
    }, { taskId: task.id, port: mcpPort })

    await waitForPtySession(mainWindow, firstResult.sessionId)

    // Split it.
    const splitResult = await mainWindow.evaluate(async ({ tabId, port }) => {
      const r = await fetch(`http://127.0.0.1:${port}/api/tabs/split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tabId })
      })
      return r.json() as Promise<{ tab: { id: string; groupId: string }; sessionId: string }>
    }, { tabId: firstResult.tab.id, port: mcpPort })

    // New pane shares the original tab's group.
    expect(splitResult.tab.groupId).toBe(firstResult.tab.groupId)
    expect(splitResult.sessionId).toBe(`${task.id}:${splitResult.tab.id}`)

    await waitForPtySession(mainWindow, splitResult.sessionId)
  })

  test('split returns 404 for unknown tab id', async ({ mainWindow }) => {
    const res = await mainWindow.evaluate(async ({ port }) => {
      const r = await fetch(`http://127.0.0.1:${port}/api/tabs/split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tabId: '00000000-0000-0000-0000-000000000000' })
      })
      return { status: r.status }
    }, { port: mcpPort })
    expect(res.status).toBe(404)
  })

  test('split 400 when tabId missing', async ({ mainWindow }) => {
    const res = await mainWindow.evaluate(async ({ port }) => {
      const r = await fetch(`http://127.0.0.1:${port}/api/tabs/split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      return { status: r.status }
    }, { port: mcpPort })
    expect(res.status).toBe(400)
  })
})
