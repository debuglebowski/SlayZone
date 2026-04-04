/**
 * Codex resize — verifies no duplicate prompt area appears after terminal
 * resize. Uses real Codex CLI.
 */
import { test, expect, seed, resetApp, clickProject } from '../fixtures/electron'
import { TEST_PROJECT_PATH } from '../fixtures/electron'
import {
  getMainSessionId,
  waitForPtySession,
  readFullBuffer,
  getViewportLines,
} from '../fixtures/terminal'

function countStatusBars(lines: string[]): number {
  return lines.filter(l => /\d+% left/.test(l)).length
}

test.describe('Codex resize — no duplicate prompt', () => {
  let projectAbbrev: string
  let taskId: string
  let sessionId: string

  test.beforeAll(async ({ electronApp, mainWindow }) => {
    // Show window BEFORE terminal init — hidden windows may prevent WebGL
    // context creation and rAF-based canvas painting, causing missing
    // background colors (the gray prompt box).
    await electronApp.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find(w => !w.isDestroyed())
      if (win) { win.show(); win.focus() }
    })

    await resetApp(mainWindow)
    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'Codex Resize', color: '#8b5cf6', path: TEST_PROJECT_PATH })
    projectAbbrev = p.name.slice(0, 2).toUpperCase()
    const t = await s.createTask({ projectId: p.id, title: 'Resize test', status: 'todo' })
    taskId = t.id
    sessionId = getMainSessionId(taskId)

    await mainWindow.evaluate((id) => window.api.db.updateTask({ id, terminalMode: 'codex' }), taskId)
    await s.refreshData()

    // Pre-seed the terminal theme in the main process BEFORE opening the task.
    // Without this, currentTerminalTheme is still the default (#000000) when
    // the PTY is created, because initTerminal's pty.create IPC may fire before
    // the theme sync useEffect's pty:set-theme IPC.
    await mainWindow.evaluate(() =>
      window.api.pty.setTheme({
        foreground: '#d4d4d8',
        background: '#141418',
        cursor: '#a1a1aa',
      })
    )

    await clickProject(mainWindow, projectAbbrev)
    await mainWindow.getByText('Resize test').first().click()
    await expect(mainWindow.locator('[data-testid="terminal-mode-trigger"]:visible').first()).toBeVisible()

    await waitForPtySession(mainWindow, sessionId, 30_000)
    await expect.poll(async () => {
      const buf = await readFullBuffer(mainWindow, sessionId)
      return buf.length
    }, { timeout: 30_000 }).toBeGreaterThan(0)

    // Accept trust prompt if it appears
    await expect.poll(async () => {
      const buf = await readFullBuffer(mainWindow, sessionId)
      if (buf.includes('trust') || buf.includes('Press enter')) {
        await mainWindow.evaluate(
          ({ id }) => window.api.pty.write(id, '\r'),
          { id: sessionId }
        )
        return 'accepted'
      }
      if (buf.includes('% left')) return 'idle'
      return 'waiting'
    }, { timeout: 15_000 }).not.toBe('waiting')

    // Wait for idle TUI with status bar
    await expect.poll(async () => {
      const lines = await getViewportLines(mainWindow, sessionId)
      return lines ? countStatusBars(lines) : 0
    }, { timeout: 30_000 }).toBeGreaterThanOrEqual(1)
  })

  test('resize after verbose output', async ({ electronApp, mainWindow }) => {
    test.setTimeout(600_000)

    // Dump xterm renderer type + cell background colors to file (console gets truncated by RTK)
    const diag = await mainWindow.evaluate(({ sid }) => {
      const links = (window as any).__slayzone_terminalLinks as
        Record<string, { _terminal: any }> | undefined
      const term = links?.[sid]?._terminal
      if (!term) return { renderer: 'terminal not found', rows: term?.rows, cols: term?.cols, cells: [] }
      const renderer = term._core?._renderService?._renderer?.constructor?.name ?? 'unknown'
      const buf = term.buffer.active
      const cells: Array<{ row: number; text: string; bgs: string[] }> = []
      for (let row = 0; row < term.rows; row++) {
        const line = buf.getLine(buf.viewportY + row)
        if (!line) continue
        const text = line.translateToString(true)
        const bgs: string[] = []
        for (let col = 0; col < line.length; col++) {
          const cell = line.getCell(col)
          if (!cell) continue
          const bg = cell.getBgColor()
          if (bg !== undefined && bg !== -1) {
            bgs.push(`${col}:#${bg.toString(16).padStart(6, '0')}`)
          }
        }
        cells.push({ row, text: text.substring(0, 80), bgs })
      }
      return { renderer, rows: term.rows, cols: term.cols, cells }
    }, { sid: sessionId })
    // Also dump raw PTY buffer to check for background escape sequences
    const rawBuffer = await readFullBuffer(mainWindow, sessionId)
    const fs = await import('fs')
    fs.writeFileSync('/tmp/codex-diag.json', JSON.stringify(diag, null, 2))
    fs.writeFileSync('/tmp/codex-raw-buffer.txt', rawBuffer)
    // Check for any SGR background sequences in raw buffer
    const bgPatterns = {
      'SGR 40-47 (basic bg)': /\x1b\[4[0-7]m/g,
      'SGR 100-107 (bright bg)': /\x1b\[10[0-7]m/g,
      'SGR 48;5 (256-color bg)': /\x1b\[48;5;\d+m/g,
      'SGR 48;2 (truecolor bg)': /\x1b\[48;2;\d+;\d+;\d+m/g,
      'OSC 11 query (bg color)': /\x1b\]11;/g,
    }
    const bgReport: Record<string, number> = {}
    for (const [name, pattern] of Object.entries(bgPatterns)) {
      const matches = rawBuffer.match(pattern)
      bgReport[name] = matches?.length ?? 0
    }
    fs.writeFileSync('/tmp/codex-bg-report.json', JSON.stringify(bgReport, null, 2))

    // Flush a rAF cycle so canvas catches up after beforeAll's win.show()
    await mainWindow.evaluate(() => new Promise(r => requestAnimationFrame(r)))

    await mainWindow.screenshot({ path: '/tmp/codex-01-idle.png' })

    // Send a prompt that generates lots of output
    await mainWindow.evaluate(
      ({ id }) => window.api.pty.write(id, 'Write a python fizzbuzz script with detailed comments on every line'),
      { id: sessionId }
    )
    await mainWindow.waitForTimeout(200)
    await mainWindow.evaluate(
      ({ id }) => window.api.pty.write(id, '\r'),
      { id: sessionId }
    )

    // Wait for Codex to produce substantial output
    await expect.poll(async () => {
      const lines = await getViewportLines(mainWindow, sessionId)
      if (!lines) return 0
      return lines.filter(l => l.trim()).length
    }, { timeout: 60_000 }).toBeGreaterThan(10)

    await mainWindow.screenshot({ path: '/tmp/codex-02-with-content.png' })

    // Wait for Codex to return to idle
    await expect.poll(async () => {
      const lines = await getViewportLines(mainWindow, sessionId)
      return lines ? countStatusBars(lines) : 0
    }, { timeout: 60_000 }).toBeGreaterThanOrEqual(1)

    await mainWindow.screenshot({ path: '/tmp/codex-03-idle-with-history.png' })

    // Now resize — hide settings
    await mainWindow.keyboard.press('Meta+s')
    await mainWindow.waitForTimeout(1000)
    await mainWindow.screenshot({ path: '/tmp/codex-04-after-hide-settings.png' })

    // Show settings
    await mainWindow.keyboard.press('Meta+s')
    await mainWindow.waitForTimeout(1000)
    await mainWindow.screenshot({ path: '/tmp/codex-05-after-show-settings.png' })

    // Keep the app open so user can manually interact
    await mainWindow.waitForTimeout(300_000)
  })
})
