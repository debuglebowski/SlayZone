/**
 * Terminal clickable URLs — verifies that URLs in terminal output are detected
 * and that clicking them opens the URL via shell.openExternal.
 *
 * Strategy: We can't click precise character positions in xterm's WebGL canvas,
 * so we exercise the full chain programmatically: WebLinkProvider.provideLinks →
 * link.activate → shell.openExternal (mocked).
 */
import { test, expect, seed, resetApp, TEST_PROJECT_PATH } from './fixtures/electron'
import {
  getMainSessionId,
  openTaskTerminal,
  runCommand,
  waitForBufferContains,
  waitForPtySession,
} from './fixtures/terminal'

test.describe('Terminal clickable URLs', () => {
  let projectAbbrev: string
  let taskId: string
  let sessionId: string

  test.beforeAll(async ({ electronApp, mainWindow }) => {
    await resetApp(mainWindow)

    // Mock shell.openExternal to capture calls
    const patchResult = await electronApp.evaluate(({ shell }) => {
      const g = globalThis as Record<string, unknown>
      g.__urlTestCalls = [] as string[]
      g.__urlTestOriginal = shell.openExternal.bind(shell)
      try {
        Object.defineProperty(shell, 'openExternal', {
          configurable: true,
          writable: true,
          value: async (url: string) => {
            ;(g.__urlTestCalls as string[]).push(url)
          },
        })
        return { ok: true as const, error: null }
      } catch (error) {
        return { ok: false as const, error: error instanceof Error ? error.message : String(error) }
      }
    })
    expect(patchResult.ok, patchResult.error ?? 'Failed to mock openExternal').toBe(true)

    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'UrlClick', color: '#06b6d4', path: TEST_PROJECT_PATH })
    projectAbbrev = p.name.slice(0, 2).toUpperCase()

    const t = await s.createTask({ projectId: p.id, title: 'URL click test', status: 'in_progress' })
    taskId = t.id
    sessionId = getMainSessionId(taskId)

    await mainWindow.evaluate((id) => window.api.db.updateTask({ id, terminalMode: 'terminal' }), taskId)
    await s.refreshData()
  })

  test.afterAll(async ({ electronApp }) => {
    await electronApp.evaluate(({ shell }) => {
      const g = globalThis as Record<string, unknown>
      if (g.__urlTestOriginal) {
        Object.defineProperty(shell, 'openExternal', {
          configurable: true,
          writable: true,
          value: g.__urlTestOriginal,
        })
      }
      delete g.__urlTestCalls
      delete g.__urlTestOriginal
    })
  })

  test('detects URL in terminal output and activates it via shell.openExternal', async ({ electronApp, mainWindow }) => {
    const testUrl = `https://example.com/test-${Date.now()}`

    await openTaskTerminal(mainWindow, { projectAbbrev, taskTitle: 'URL click test' })
    await waitForPtySession(mainWindow, sessionId)
    await runCommand(mainWindow, sessionId, `echo "${testUrl}"`)
    await waitForBufferContains(mainWindow, sessionId, testUrl)

    // Wait for the URL to appear in xterm's frontend buffer (not just the backend PTY buffer).
    // Data flows: PTY → IPC → rAF batching → xterm.write, so there's a small delay.
    await expect.poll(async () => {
      return mainWindow.evaluate(({ sessionId, needle }) => {
        const w = window as unknown as Record<string, unknown>
        const links = w.__slayzone_terminalLinks as
          Record<string, { _terminal: { buffer: { active: { length: number; getLine(i: number): { translateToString(trimRight?: boolean): string } | undefined } } } }>
          | undefined
        const provider = links?.[sessionId]
        if (!provider) return false
        const buf = provider._terminal.buffer.active
        for (let i = 0; i < buf.length; i++) {
          const line = buf.getLine(i)
          if (line?.translateToString(true).includes(needle)) return true
        }
        return false
      }, { sessionId, needle: 'example.com' })
    }, { timeout: 10_000, message: 'URL never appeared in xterm frontend buffer' }).toBe(true)

    // Use the exposed WebLinkProvider to find and activate the link.
    // This exercises the full chain: provideLinks → regex match → activate → shell.openExternal
    const result = await mainWindow.evaluate(async ({ sessionId, url }) => {
      const w = window as unknown as Record<string, unknown>
      const links = w.__slayzone_terminalLinks as
        Record<string, { _terminal: { buffer: { active: { length: number } } }; provideLinks(y: number, cb: (links: Array<{ text: string; activate: (e: MouseEvent, text: string) => void }> | undefined) => void): void }>
        | undefined

      const provider = links?.[sessionId]
      if (!provider) return { found: false, error: 'no link provider for session' }

      const bufferLength = provider._terminal.buffer.active.length

      for (let line = 1; line <= bufferLength; line++) {
        const found = await new Promise<boolean>((resolve) => {
          provider.provideLinks(line, (result) => {
            const match = result?.find((l) => l.text === url)
            if (match) {
              match.activate(new MouseEvent('click', { metaKey: true, shiftKey: true }), match.text)
              resolve(true)
            } else {
              resolve(false)
            }
          })
        })
        if (found) return { found: true, error: null }
      }
      return { found: false, error: `URL not found in ${bufferLength} buffer lines` }
    }, { sessionId, url: testUrl })

    expect(result.found, result.error ?? 'Link not found').toBe(true)

    // Verify shell.openExternal was called with our URL
    const calls = await electronApp.evaluate(() => {
      return (globalThis as Record<string, unknown>).__urlTestCalls as string[]
    })
    expect(calls).toContain(testUrl)
  })
})
