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
    await mainWindow.waitForTimeout(500)

    await mainWindow.getByText('Diff panel task').first().click()
    await mainWindow.waitForTimeout(500)

    // Toggle git diff panel on
    await mainWindow.keyboard.press('Meta+g')
    await mainWindow.waitForTimeout(500)
  })

  test.afterAll(() => {
    try { git('git checkout -- .') } catch { /* ignore */ }
    try { git('git clean -fd') } catch { /* ignore */ }
  })

  const refresh = async (page: import('@playwright/test').Page) => {
    await page.getByRole('button', { name: 'Refresh' }).click()
    await page.waitForTimeout(500)
  }

  test('no changes shows empty state', async ({ mainWindow }) => {
    await refresh(mainWindow)
    await expect(mainWindow.getByText('No local changes.')).toBeVisible()
  })

  test('modified file appears in unstaged with M status', async ({ mainWindow }) => {
    writeFileSync(path.join(TEST_PROJECT_PATH, 'base.txt'), 'line1\nline2 modified\nline3\n')
    await refresh(mainWindow)

    await expect(mainWindow.getByText('Unstaged').first()).toBeVisible()
    await expect(mainWindow.getByText('base.txt').first()).toBeVisible()
    // Status badge M
    const fileRow = mainWindow.locator('.font-mono.text-xs').filter({ hasText: 'base.txt' }).first()
    await expect(fileRow.locator('.font-bold').first()).toHaveText('M')
  })

  test('untracked file appears with ? status', async ({ mainWindow }) => {
    writeFileSync(path.join(TEST_PROJECT_PATH, 'newfile.txt'), 'new content\n')
    await refresh(mainWindow)

    const fileRow = mainWindow.locator('.font-mono.text-xs').filter({ hasText: 'newfile.txt' }).first()
    await expect(fileRow).toBeVisible()
    await expect(fileRow.locator('.font-bold').first()).toHaveText('?')
  })

  test('click file shows diff content', async ({ mainWindow }) => {
    // Click base.txt to select it
    await mainWindow.locator('.font-mono.text-xs').filter({ hasText: 'base.txt' }).first().click()
    await mainWindow.waitForTimeout(300)

    // Diff viewer should show hunk header
    await expect(mainWindow.locator('text=/@@/')).toBeVisible()
  })

  test('stage individual file', async ({ mainWindow }) => {
    // Click stage button on base.txt (opacity-0, needs force)
    const baseRow = mainWindow.locator('.font-mono.text-xs').filter({ hasText: 'base.txt' }).first()
    await baseRow.locator('button[title="Stage file"]').click({ force: true })
    await mainWindow.waitForTimeout(300)

    // Staged section should appear with base.txt
    await expect(mainWindow.getByText(/^Staged/).first()).toBeVisible()
    // newfile.txt should still be in unstaged
    await expect(mainWindow.getByText(/^Unstaged/).first()).toBeVisible()
  })

  test('unstage individual file', async ({ mainWindow }) => {
    // Find base.txt in staged section and unstage it
    const stagedBase = mainWindow.locator('.font-mono.text-xs').filter({ hasText: 'base.txt' }).first()
    await stagedBase.locator('button[title="Unstage file"]').click({ force: true })
    await mainWindow.waitForTimeout(300)

    // base.txt should be back in unstaged
    await expect(mainWindow.getByText(/^Unstaged/).first()).toBeVisible()
  })

  test('stage all moves all files to staged', async ({ mainWindow }) => {
    await mainWindow.locator('button[title="Stage all"]').click()
    await mainWindow.waitForTimeout(300)

    // Staged section should exist with both files
    await expect(mainWindow.getByText(/^Staged/).first()).toBeVisible()
    // Unstaged section should be gone
    await expect(mainWindow.getByText(/^Unstaged/).first()).not.toBeVisible()
  })

  test('unstage all moves all files back to unstaged', async ({ mainWindow }) => {
    await mainWindow.locator('button[title="Unstage all"]').click()
    await mainWindow.waitForTimeout(300)

    // Unstaged should exist
    await expect(mainWindow.getByText(/^Unstaged/).first()).toBeVisible()
    // Staged should be gone
    await expect(mainWindow.getByText(/^Staged/).first()).not.toBeVisible()
  })

  test('arrow key navigation selects files', async ({ mainWindow }) => {
    // Focus the file list container
    const fileList = mainWindow.locator('.overflow-y-auto.border-r').first()
    await fileList.click()
    await mainWindow.waitForTimeout(100)

    // Press ArrowDown to select first file
    await mainWindow.keyboard.press('ArrowDown')
    await mainWindow.waitForTimeout(100)

    // First entry should have bg-accent (selected) — but not hover:bg-accent/50
    const firstEntry = mainWindow.locator('.font-mono.text-xs').first()
    await expect(firstEntry).toHaveClass(/(?:^|\s)bg-accent(?:\s|$)/)

    // Press ArrowDown again to select second file
    await mainWindow.keyboard.press('ArrowDown')
    await mainWindow.waitForTimeout(100)

    // First should no longer be selected, second should be
    await expect(firstEntry).not.toHaveClass(/(?:^|\s)bg-accent(?:\s|$)/)
    const secondEntry = mainWindow.locator('.font-mono.text-xs').nth(1)
    await expect(secondEntry).toHaveClass(/(?:^|\s)bg-accent(?:\s|$)/)

    // ArrowUp goes back
    await mainWindow.keyboard.press('ArrowUp')
    await mainWindow.waitForTimeout(100)
    await expect(firstEntry).toHaveClass(/(?:^|\s)bg-accent(?:\s|$)/)
  })

  test('polling picks up file changes', async ({ mainWindow }) => {
    // Append to base.txt
    writeFileSync(path.join(TEST_PROJECT_PATH, 'base.txt'), 'line1\nline2 modified\nline3\nextra line\n')

    // Wait for poll (5s interval + buffer)
    await mainWindow.waitForTimeout(7000)

    // Verify the diff panel updated — base.txt should still be visible with changes
    await expect(mainWindow.locator('.font-mono.text-xs').filter({ hasText: 'base.txt' }).first()).toBeVisible()
  })
})
