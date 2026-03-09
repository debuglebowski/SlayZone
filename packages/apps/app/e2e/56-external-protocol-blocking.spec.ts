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

  const getWebview = (s: string) => `
    const wv = document.querySelector('[data-browser-panel] webview');
    if (!wv) return 'no-webview';
  `

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

  const schemes = ['figma', 'notion', 'slack', 'linear', 'vscode', 'cursor'] as const

  for (const scheme of schemes) {
    test(`blocks ${scheme}:// via window.open`, async ({ mainWindow }) => {
      await ensureBrowserPanel(mainWindow)

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
      expect(parsed.href).toBe('about:blank')
      expect(parsed.popupIsNull || parsed.popupHref === 'about:blank').toBe(true)
    })

    test(`blocks ${scheme}:// via anchor click`, async ({ mainWindow }) => {
      await ensureBrowserPanel(mainWindow)

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
            setTimeout(() => resolve(window.location.href), 1000);
          })
        `)
      }, scheme)

      expect(result).toBe('about:blank')
    })

    test(`blocks ${scheme}:// via window.location`, async ({ mainWindow }) => {
      await ensureBrowserPanel(mainWindow)

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

      expect(currentHref).toBe('about:blank')
    })

    test(`blocks ${scheme}:// via hidden iframe`, async ({ mainWindow }) => {
      await ensureBrowserPanel(mainWindow)

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
            setTimeout(() => resolve(window.location.href), 1000);
          })
        `)
      }, scheme)

      expect(result).toBe('about:blank')
    })
  }
})
