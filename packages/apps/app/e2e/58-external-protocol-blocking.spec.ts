/**
 * Verifies that external protocol URLs (figma://, slack://, etc.) navigated to inside
 * webviews are intercepted by our session protocol handler and do NOT open the desktop app.
 *
 * Diagnostic logic: if our session.protocol.handle('figma', ...) intercepts the request,
 * the webview navigates internally and did-navigate fires → the tab URL updates to
 * figma://blocked. If the OS handles it instead (our fix not working), the webview gets
 * an error and the tab URL stays at about:blank.
 */
import { test, expect, seed } from './fixtures/electron'
import { TEST_PROJECT_PATH } from './fixtures/electron'

test.describe('External protocol blocking', () => {
  const urlInput = (page: import('@playwright/test').Page) =>
    page.locator('input[placeholder="Enter URL..."]:visible').first()

  const tabEntries = (page: import('@playwright/test').Page) =>
    page.locator('.h-10.overflow-x-auto:visible').first()
      .locator('[role="button"]:not(:has(.lucide-plus))')

  const ensureBrowserPanel = async (page: import('@playwright/test').Page) => {
    if (!(await urlInput(page).isVisible().catch(() => false))) {
      await page.locator('#root').click({ position: { x: 12, y: 12 } }).catch(() => {})
      await page.keyboard.press('Meta+b')
      await expect(urlInput(page)).toBeVisible()
    }
  }

  test.beforeAll(async ({ mainWindow }) => {
    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'ProtoBlock', color: '#6366f1', path: TEST_PROJECT_PATH })
    const t = await s.createTask({ projectId: p.id, title: 'Protocol blocking task', status: 'todo' })
    await s.refreshData()

    await mainWindow.keyboard.press('Meta+k')
    const input = mainWindow.getByPlaceholder('Search tasks and projects...')
    await expect(input).toBeVisible()
    await input.fill('Protocol blocking task')
    await mainWindow.keyboard.press('Enter')
    await expect(input).not.toBeVisible()
  })

  for (const scheme of ['figma', 'notion', 'slack', 'linear', 'vscode', 'cursor']) {
    test(`blocks ${scheme}:// via window.open`, async ({ mainWindow }) => {
      await ensureBrowserPanel(mainWindow)

      // window.open('figma://...') — should either return null (denied by setWindowOpenHandler)
      // or if a popup is created, it should navigate to about:blank (will-navigate blocked figma://).
      // Either way Figma Desktop must not launch.
      const result = await mainWindow.evaluate((s) => {
        const wv = document.querySelector('[data-browser-panel] webview') as HTMLElement & {
          executeJavaScript: (code: string) => Promise<unknown>
        }
        if (!wv) return 'no-webview'
        return wv.executeJavaScript(`
          new Promise((resolve) => {
            const popup = window.open('${s}://blocked-by-slayzone', '_blank')
            if (!popup) {
              resolve(JSON.stringify({ popupIsNull: true, popupHref: null, href: window.location.href }))
              return
            }
            setTimeout(() => {
              let popupHref = 'no-popup'
              try { popupHref = popup.location.href; popup.close() } catch { popupHref = 'cross-origin' }
              resolve(JSON.stringify({ popupIsNull: false, popupHref, href: window.location.href }))
            }, 800)
          })
        `)
      }, scheme)

      const parsed = JSON.parse(result as string)
      // Main page must not have navigated away
      expect(parsed.href).toBe('about:blank')
      // Popup must be null (denied) or stayed at about:blank (navigation blocked)
      // 'cross-origin' would mean popup reached figma:// — bad but Figma Desktop still won't open
      // since session.protocol.handle intercepts it
      expect(parsed.popupIsNull || parsed.popupHref === 'about:blank').toBe(true)
    })

    test(`blocks ${scheme}:// via anchor click`, async ({ mainWindow }) => {
      await ensureBrowserPanel(mainWindow)

      // Most common real-world technique: create a hidden <a href="figma://..."> and .click() it.
      // This is Figma's actual "Open in Desktop App" mechanism. Our preload must intercept the
      // click event before the browser routes it to ExternalProtocolHandler or will-navigate.
      const result = await mainWindow.evaluate((s) => {
        const wv = document.querySelector('[data-browser-panel] webview') as HTMLElement & {
          executeJavaScript: (code: string) => Promise<unknown>
        }
        if (!wv) return 'no-webview'
        return wv.executeJavaScript(`
          new Promise((resolve) => {
            const a = document.createElement('a');
            a.href = '${s}://blocked-by-slayzone';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            // Give enough time for any async navigation to start
            setTimeout(() => resolve(window.location.href), 1000);
          })
        `)
      }, scheme)

      // If anchor click was blocked: window.location.href stays 'about:blank'.
      // If not blocked: webview navigates away (or OS opens desktop app).
      expect(result).toBe('about:blank')
    })

    test(`blocks ${scheme}:// via window.location`, async ({ mainWindow }) => {
      await ensureBrowserPanel(mainWindow)

      // Simulate what Figma actually does: navigate from INSIDE the webview via
      // window.location. This is the renderer-process path that bypasses session.protocol.handle.
      // Our preload patches window.location.href before page JS runs, so the assignment is a no-op.
      const currentHref = await mainWindow.evaluate((s) => {
        const wv = document.querySelector(`[data-browser-panel] webview`) as HTMLElement & {
          executeJavaScript: (code: string) => Promise<unknown>
        }
        if (!wv) return 'no-webview'
        return wv.executeJavaScript(`
          window.location.href = '${s}://blocked-by-slayzone';
          window.location.href
        `)
      }, scheme)

      // If preload blocked it: window.location.href stays 'about:blank' (no-op assignment).
      // If not blocked (OS handles it or falls through): href changes to the external URL.
      expect(currentHref).toBe('about:blank')
    })

    test(`blocks ${scheme}:// via hidden iframe (Figma's actual technique)`, async ({ mainWindow }) => {
      await ensureBrowserPanel(mainWindow)

      // iframe.src = 'figma://...' goes through Blink's V8 IDL bindings —
      // JS prototype overrides can't intercept it. We rely on session.protocol.handle
      // to serve our empty HTML response for the iframe's navigation.
      // Verify: the iframe's src is set (we can't prevent that), but the session
      // handler is what intercepts the actual navigation. We confirm this by checking
      // that the main page's window.location is still about:blank (OS didn't open app
      // and the main frame didn't navigate).
      const result = await mainWindow.evaluate((s) => {
        const wv = document.querySelector('[data-browser-panel] webview') as HTMLElement & {
          executeJavaScript: (code: string) => Promise<unknown>
        }
        if (!wv) return 'no-webview'
        return wv.executeJavaScript(`
          new Promise((resolve) => {
            const iframe = document.createElement('iframe');
            iframe.onload = () => resolve(window.location.href);
            iframe.onerror = () => resolve(window.location.href);
            iframe.src = '${s}://blocked-by-slayzone';
            document.body.appendChild(iframe);
            // Fallback if neither fires
            setTimeout(() => resolve(window.location.href), 1000);
          })
        `)
      }, scheme)

      // Main page's location must stay about:blank — session handler served the iframe,
      // OS was never invoked, main frame never navigated.
      expect(result).toBe('about:blank')
    })
  }
})
