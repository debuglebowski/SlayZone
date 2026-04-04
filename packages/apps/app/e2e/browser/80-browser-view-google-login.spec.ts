import { writeFileSync } from 'fs'
import { test, expect, seed, resetApp, TEST_PROJECT_PATH } from '../fixtures/electron'
import {
  testInvoke, ensureBrowserPanelVisible, openTaskViaSearch, getActiveViewId,
} from '../fixtures/browser-view'

/**
 * Tests whether Google accepts our browser after submitting an email.
 * Google's "browser not safe" error appears AFTER clicking "Next" on
 * the email step, not on initial page load.
 *
 * Uses a fake email — Google shows "Couldn't find your Google Account"
 * for unrecognized emails (= browser accepted) vs "browser or app may
 * not be safe" (= browser blocked).
 */
test.describe('Google login detection (WebContentsView)', () => {
  let taskId: string

  test.beforeAll(async ({ mainWindow }) => {
    await resetApp(mainWindow)
    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'Google Auth', color: '#0ea5e9', path: TEST_PROJECT_PATH })
    const t = await s.createTask({ projectId: p.id, title: 'Google login test', status: 'todo' })
    taskId = t.id
    await s.refreshData()
    await openTaskViaSearch(mainWindow, 'Google login test')
  })

  test('Google accepts browser after email submission', async ({ mainWindow }) => {
    test.setTimeout(60000)
    await ensureBrowserPanelVisible(mainWindow)
    const viewId = await getActiveViewId(mainWindow, taskId)

    // Navigate to Google sign-in
    await testInvoke(mainWindow, 'browser:navigate', viewId, 'https://accounts.google.com/signin')

    await expect.poll(async () => {
      const url = (await testInvoke(mainWindow, 'browser:get-url', viewId)) as string
      return url.includes('accounts.google.com')
    }, { timeout: 20000 }).toBe(true)

    await expect.poll(async () => {
      return await testInvoke(mainWindow, 'browser:execute-js', viewId, 'document.readyState') as string
    }, { timeout: 15000 }).toBe('complete')

    // Wait for email input
    await expect.poll(async () => {
      return await testInvoke(mainWindow, 'browser:execute-js', viewId, `
        !!(document.querySelector('#identifierId') || document.querySelector('input[type="email"]'))
      `) as boolean
    }, { timeout: 15000, message: 'Email input should appear' }).toBe(true)

    // Enter fake email and click Next
    await testInvoke(mainWindow, 'browser:execute-js', viewId, `
      (function() {
        var input = document.querySelector('#identifierId') || document.querySelector('input[type="email"]');
        if (!input) return false;
        input.focus();
        input.value = 'slayzone.e2e.detection.test@gmail.com';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      })()
    `)

    await testInvoke(mainWindow, 'browser:execute-js', viewId, `
      (function() {
        var btn = document.querySelector('#identifierNext');
        if (!btn) {
          var buttons = Array.from(document.querySelectorAll('button'));
          btn = buttons.find(function(b) { return b.textContent.trim() === 'Next' || b.textContent.trim() === 'Nästa'; });
        }
        if (btn) { btn.click(); return true; }
        return false;
      })()
    `)

    // Wait for Google to respond
    await mainWindow.waitForTimeout(8000)

    const finalUrl = await testInvoke(mainWindow, 'browser:get-url', viewId) as string
    const bodyText = await testInvoke(mainWindow, 'browser:execute-js', viewId,
      'document.body?.innerText || ""'
    ) as string

    writeFileSync('/tmp/slayzone-google-login-diagnostics.txt', [
      'Final URL: ' + finalUrl,
      'Body text:', bodyText.slice(0, 3000),
    ].join('\n'))

    const blockedSignals = [
      'browser or app may not be safe',
      'browser or app may not be secure',
      'inte vara säker', 'kanske inte är säker',
      'disallowed_useragent', 'Inloggningen misslyckades',
      'couldn\'t sign you in',
      'This browser or app may not be secure',
    ]

    const isBlocked = blockedSignals.some(s => bodyText.toLowerCase().includes(s.toLowerCase()))

    expect(isBlocked, [
      'Google blocked the browser.',
      'URL: ' + finalUrl,
      'Page text:', bodyText.slice(0, 1000),
    ].join('\n')).toBe(false)
  })
})
