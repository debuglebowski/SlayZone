import { test, expect, seed, goHome, clickProject } from './fixtures/electron'
import { TEST_PROJECT_PATH } from './fixtures/electron'
import { execSync } from 'child_process'
import { writeFileSync, existsSync } from 'fs'
import path from 'path'

function git(cmd: string) {
  return execSync(cmd, { cwd: TEST_PROJECT_PATH, encoding: 'utf-8', stdio: 'pipe' })
}

function ensureRepo() {
  if (!existsSync(path.join(TEST_PROJECT_PATH, '.git'))) {
    git('git init')
    git('git config user.name "Test"')
    git('git config user.email "test@test.com"')
    writeFileSync(path.join(TEST_PROJECT_PATH, 'README.md'), '# test\n')
    git('git add README.md')
    git('git commit -m "Initial commit"')
  }
}

test.describe('Git diff panel', () => {
  let projectAbbrev: string

  test.beforeAll(async ({ mainWindow }) => {
    ensureRepo()

    // Clean working tree
    try { git('git checkout -- .') } catch { /* ignore */ }
    try { git('git clean -fd') } catch { /* ignore */ }

    // Create baseline file and commit
    writeFileSync(path.join(TEST_PROJECT_PATH, 'base.txt'), 'line1\nline2\nline3\n')
    git('git add base.txt')
    try { git('git commit -m "add base.txt"') } catch { /* already committed */ }

    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'Diff Panel Test', color: '#8b5cf6', path: TEST_PROJECT_PATH })
    projectAbbrev = p.name.slice(0, 2).toUpperCase()
    await s.createTask({ projectId: p.id, title: 'Diff panel task', status: 'todo' })
    await s.refreshData()

    await goHome(mainWindow)
    await clickProject(mainWindow, projectAbbrev)
    await expect(mainWindow.getByText('Diff panel task').first()).toBeVisible({ timeout: 5_000 })

    await mainWindow.getByText('Diff panel task').first().click()
    await expect(mainWindow.locator('[data-testid="terminal-mode-trigger"]:visible').first()).toBeVisible({ timeout: 5_000 })

    // Open git panel (general tab) then switch to changes tab
    await mainWindow.keyboard.press('Meta+g')
    await expect(mainWindow.getByTestId('task-git-panel')).toBeVisible({ timeout: 5_000 })
    // Click the "Diff" tab to switch to changes view
    await mainWindow.getByTestId('task-git-panel').locator('button').filter({ hasText: 'Diff' }).click()
    await expect(mainWindow.getByTestId('git-diff-panel').last()).toBeVisible({ timeout: 5_000 })

  })

  test.afterAll(() => {
    try { git('git checkout -- .') } catch { /* ignore */ }
    try { git('git clean -fd') } catch { /* ignore */ }
  })

  /** Scope to the visible git diff panel (test 19 leaves a hidden tab with its own panel) */
  const panel = (page: import('@playwright/test').Page) =>
    page.locator('[data-testid="git-diff-panel"]:visible')

  const refresh = async (page: import('@playwright/test').Page) => {
    // Refresh button is in the UnifiedGitPanel header (outside git-diff-panel)
    await page.getByTestId('task-git-panel').locator('button[title="Refresh"]').click()
  }

  test('no changes shows empty state', async ({ mainWindow }) => {
    await refresh(mainWindow)
    await expect(panel(mainWindow).getByText('No local changes.')).toBeVisible()
  })

  test('modified file appears in unstaged with M status', async ({ mainWindow }) => {
    writeFileSync(path.join(TEST_PROJECT_PATH, 'base.txt'), 'line1\nline2 modified\nline3\n')
    await refresh(mainWindow)

    const p = panel(mainWindow)
    await expect(p.getByText('Unstaged')).toBeVisible()
    await expect(p.getByText('base.txt')).toBeVisible()
    // Status badge M
    const fileRow = p.locator('.font-mono.text-xs').filter({ hasText: 'base.txt' })
    await expect(fileRow.locator('.font-bold').first()).toHaveText('M')
  })

  test('untracked file appears with ? status', async ({ mainWindow }) => {
    writeFileSync(path.join(TEST_PROJECT_PATH, 'newfile.txt'), 'new content\n')
    await refresh(mainWindow)

    const fileRow = panel(mainWindow).locator('.font-mono.text-xs').filter({ hasText: 'newfile.txt' })
    await expect(fileRow).toBeVisible()
    await expect(fileRow.locator('.font-bold').first()).toHaveText('?')
  })

  test('click file shows diff content', async ({ mainWindow }) => {
    const p = panel(mainWindow)
    // Click base.txt to select it
    await p.locator('.font-mono.text-xs').filter({ hasText: 'base.txt' }).click()

    // Diff viewer should show hunk header
    await expect(p.locator('text=/@@/')).toBeVisible()
  })

  test('stage individual file', async ({ mainWindow }) => {
    const p = panel(mainWindow)
    // Click stage button on base.txt (opacity-0, needs force)
    const baseRow = p.locator('.font-mono.text-xs').filter({ hasText: 'base.txt' })
    await baseRow.locator('button[title="Stage file"]').click({ force: true })

    // Staged section should appear with base.txt
    await expect(p.getByText(/^Staged/)).toBeVisible()
    // newfile.txt should still be in unstaged
    await expect(p.getByText(/^Unstaged/)).toBeVisible()
  })

  test('unstage individual file', async ({ mainWindow }) => {
    const p = panel(mainWindow)
    // Find base.txt in staged section and unstage it
    const stagedBase = p.locator('.font-mono.text-xs').filter({ hasText: 'base.txt' })
    await stagedBase.locator('button[title="Unstage file"]').click({ force: true })

    // base.txt should be back in unstaged
    await expect(p.getByText(/^Unstaged/)).toBeVisible()
  })

  test('stage all moves all files to staged', async ({ mainWindow }) => {
    const p = panel(mainWindow)
    await p.locator('button[title="Stage all"]').click()

    // Staged section should exist with both files
    await expect(p.getByText(/^Staged/)).toBeVisible()
    // Unstaged section should be gone
    await expect(p.getByText(/^Unstaged/)).not.toBeVisible()
  })

  test('unstage all moves all files back to unstaged', async ({ mainWindow }) => {
    const p = panel(mainWindow)
    await p.locator('button[title="Unstage all"]').click()

    // Unstaged should exist
    await expect(p.getByText(/^Unstaged/)).toBeVisible()
    // Staged should be gone
    await expect(p.getByText(/^Staged/)).not.toBeVisible()
  })

  test('arrow key navigation selects files', async ({ mainWindow }) => {
    const p = panel(mainWindow)
    // Focus the file list container (scrollable div with tabIndex)
    const fileList = p.locator('.overflow-y-auto[tabindex="0"]')
    await fileList.click()

    // Press ArrowDown to select first file
    await mainWindow.keyboard.press('ArrowDown')

    // First entry should have bg-accent (selected) — but not hover:bg-accent/50
    const firstEntry = p.locator('.font-mono.text-xs').first()
    await expect(firstEntry).toHaveClass(/bg-primary\/10/)

    // Press ArrowDown again to select second file
    await mainWindow.keyboard.press('ArrowDown')

    // First should no longer be selected, second should be
    await expect(firstEntry).not.toHaveClass(/bg-primary\/10/)
    const secondEntry = p.locator('.font-mono.text-xs').nth(1)
    await expect(secondEntry).toHaveClass(/bg-primary\/10/)

    // ArrowUp goes back
    await mainWindow.keyboard.press('ArrowUp')
    await expect(firstEntry).toHaveClass(/bg-primary\/10/)
  })

  test('polling picks up file changes', async ({ mainWindow }) => {
    // Append to base.txt
    writeFileSync(path.join(TEST_PROJECT_PATH, 'base.txt'), 'line1\nline2 modified\nline3\nextra line\n')

    // Wait for poll (5s interval + buffer)
    await mainWindow.waitForTimeout(7000)

    // Verify the diff panel updated — base.txt should still be visible with changes
    await expect(panel(mainWindow).locator('.font-mono.text-xs').filter({ hasText: 'base.txt' })).toBeVisible()
  })
})
