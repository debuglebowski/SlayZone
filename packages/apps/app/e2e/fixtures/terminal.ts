import type { Page } from '@playwright/test'
import { expect } from './electron'
import { clickProject, goHome } from './electron'
import type { TerminalMode, TerminalState } from '@slayzone/terminal/shared'

function activeModeTrigger(page: Page) {
  return page.locator('[data-testid="terminal-mode-trigger"]:visible').first()
}

export function getMainSessionId(taskId: string): string {
  return `${taskId}:${taskId}`
}

export function getTabSessionId(taskId: string, tabId: string): string {
  return `${taskId}:${tabId}`
}

export async function openTaskTerminal(
  page: Page,
  opts: { projectAbbrev: string; taskTitle: string }
): Promise<void> {
  await goHome(page)
  await clickProject(page, opts.projectAbbrev)

  const taskCardTitle = page.locator('p.line-clamp-3:visible', { hasText: opts.taskTitle }).first()
  if (await taskCardTitle.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await taskCardTitle.click()
  } else {
    await page.keyboard.press('Meta+k')
    const searchInput = page.getByPlaceholder('Search tasks and projects...')
    await expect(searchInput).toBeVisible()
    await searchInput.fill(opts.taskTitle)
    const dialog = page.locator('[role="dialog"]:visible').last()
    await dialog.getByText(opts.taskTitle).first().click()
  }

  await expect(activeModeTrigger(page)).toBeVisible()
}

export async function switchTerminalMode(page: Page, mode: TerminalMode): Promise<void> {
  const labels: Record<TerminalMode, string> = {
    'claude-code': 'Claude Code',
    codex: 'Codex',
    terminal: 'Terminal',
  }

  const trigger = activeModeTrigger(page)
  await trigger.click()
  await page.getByRole('option', { name: labels[mode] }).click()
  await expect(trigger).toHaveText(labels[mode])
}

export async function waitForPtySession(
  page: Page,
  sessionId: string,
  timeoutMs = 10_000
): Promise<void> {
  await expect
    .poll(
      async () => page.evaluate((id) => window.api.pty.exists(id), sessionId),
      { timeout: timeoutMs }
    )
    .toBe(true)
}

export async function waitForNoPtySession(
  page: Page,
  sessionId: string,
  timeoutMs = 10_000
): Promise<void> {
  await expect
    .poll(
      async () => page.evaluate((id) => window.api.pty.exists(id), sessionId),
      { timeout: timeoutMs }
    )
    .toBe(false)
}

export async function waitForPtyState(
  page: Page,
  sessionId: string,
  state: TerminalState,
  timeoutMs = 10_000
): Promise<void> {
  await expect
    .poll(
      async () => page.evaluate((id) => window.api.pty.getState(id), sessionId),
      { timeout: timeoutMs }
    )
    .toBe(state)
}

export async function readFullBuffer(page: Page, sessionId: string): Promise<string> {
  return page.evaluate((id) => window.api.pty.getBuffer(id) ?? '', sessionId)
}

export async function readBufferSince(
  page: Page,
  sessionId: string,
  afterSeq: number
): Promise<{ currentSeq: number; chunks: Array<{ seq: number; data: string }> } | null> {
  return page.evaluate(
    ({ id, after }) => window.api.pty.getBufferSince(id, after),
    { id: sessionId, after: afterSeq }
  )
}

export async function runCommand(page: Page, sessionId: string, command: string): Promise<void> {
  await page.evaluate(
    ({ id, cmd }) => {
      window.api.pty.write(id, `${cmd}\r`)
    },
    { id: sessionId, cmd: command }
  )
}

export async function waitForBufferContains(
  page: Page,
  sessionId: string,
  needle: string,
  timeoutMs = 10_000
): Promise<void> {
  await expect
    .poll(async () => {
      const buffer = await readFullBuffer(page, sessionId)
      return buffer.includes(needle)
    }, { timeout: timeoutMs })
    .toBe(true)
}
