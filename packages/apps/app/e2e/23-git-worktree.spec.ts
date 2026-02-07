import { test, expect, seed, goHome, clickProject } from './fixtures/electron'
import { TEST_PROJECT_PATH } from './fixtures/electron'
import { execSync } from 'child_process'
import path from 'path'

test.describe('Git worktree operations', () => {
  let projectAbbrev: string
  let taskId: string
  const branchName = 'worktree-task' // slugify('Worktree task')

  test.beforeAll(async ({ mainWindow }) => {
    // Ensure test project dir has a git repo with an initial commit
    try { execSync('git rev-parse --is-inside-work-tree', { cwd: TEST_PROJECT_PATH }) }
    catch {
      execSync('git init', { cwd: TEST_PROJECT_PATH })
      execSync('git config user.name "Test"', { cwd: TEST_PROJECT_PATH })
      execSync('git config user.email "test@test.com"', { cwd: TEST_PROJECT_PATH })
      execSync('touch README.md', { cwd: TEST_PROJECT_PATH })
      execSync('git add README.md', { cwd: TEST_PROJECT_PATH })
      execSync('git commit -m "Initial commit"', { cwd: TEST_PROJECT_PATH })
    }

    // Clean up any leftover worktrees from previous runs
    try {
      execSync('git worktree prune', { cwd: TEST_PROJECT_PATH })
      const worktreeDir = path.join(TEST_PROJECT_PATH, 'worktrees')
      execSync(`rm -rf "${worktreeDir}"`, { cwd: TEST_PROJECT_PATH })
    } catch { /* ignore */ }

    // Delete branch if it exists from a previous run
    try { execSync(`git branch -D ${branchName}`, { cwd: TEST_PROJECT_PATH }) } catch { /* ignore */ }

    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'Worktree Test', color: '#10b981', path: TEST_PROJECT_PATH })
    projectAbbrev = p.name.slice(0, 2).toUpperCase()
    const t = await s.createTask({ projectId: p.id, title: 'Worktree task', status: 'todo' })
    taskId = t.id
    await s.refreshData()

    await goHome(mainWindow)
    await clickProject(mainWindow, projectAbbrev)
    await mainWindow.waitForTimeout(500)

    // Open task detail
    await mainWindow.getByText('Worktree task').first().click()
    await mainWindow.waitForTimeout(500)
  })

  test('git panel shows current branch', async ({ mainWindow }) => {
    // Settings panel is visible by default — GitPanel should show branch
    await expect(mainWindow.getByText('Git').first()).toBeVisible()
    // Should show main or master
    const branchText = mainWindow.locator('text=/main|master/')
    await expect(branchText.first()).toBeVisible()
  })

  test('shows Add Worktree button when no worktree', async ({ mainWindow }) => {
    await expect(mainWindow.getByRole('button', { name: /Add Worktree/ })).toBeVisible()
  })

  test('create worktree', async ({ mainWindow }) => {
    await mainWindow.getByRole('button', { name: /Add Worktree/ }).click()
    // Wait for creation (git worktree add)
    await mainWindow.waitForTimeout(2000)

    // Worktree name should appear (derived from slugified task title)
    await expect(mainWindow.getByText(branchName)).toBeVisible()
  })

  test('worktree shows parent branch', async ({ mainWindow }) => {
    // "from main" or "from master"
    const fromBranch = mainWindow.locator('text=/from (main|master)/')
    await expect(fromBranch.first()).toBeVisible()
  })

  test('worktree path persisted in DB', async ({ mainWindow }) => {
    const task = await mainWindow.evaluate((id) => window.api.db.getTask(id), taskId)
    expect(task?.worktree_path).toContain(branchName)
    expect(task?.worktree_parent_branch).toMatch(/main|master/)
  })

  test('merge button visible', async ({ mainWindow }) => {
    const mergeBtn = mainWindow.getByRole('button', { name: /Merge into/ })
    await expect(mergeBtn).toBeVisible()
  })

  test('remove worktree button visible', async ({ mainWindow }) => {
    // Trash icon button with tooltip "Remove worktree"
    const deleteBtn = mainWindow.locator('button').filter({ has: mainWindow.locator('.lucide-trash-2') })
    await expect(deleteBtn.first()).toBeVisible()
  })

  test('delete worktree', async ({ mainWindow }) => {
    const deleteBtn = mainWindow.locator('button').filter({ has: mainWindow.locator('.lucide-trash-2') })
    await deleteBtn.first().click()
    await mainWindow.waitForTimeout(1000)

    // Add Worktree button should reappear
    await expect(mainWindow.getByRole('button', { name: /Add Worktree/ })).toBeVisible()
  })

  test('worktree path cleared in DB after delete', async ({ mainWindow }) => {
    const task = await mainWindow.evaluate((id) => window.api.db.getTask(id), taskId)
    expect(task?.worktree_path).toBeNull()
  })

  test('create and verify branch exists in git', async ({ mainWindow }) => {
    // Clean up branch from previous create/delete cycle
    try { execSync(`git branch -D ${branchName}`, { cwd: TEST_PROJECT_PATH }) } catch { /* ignore */ }
    try { execSync('git worktree prune', { cwd: TEST_PROJECT_PATH }) } catch { /* ignore */ }
    try { execSync(`rm -rf "${path.join(TEST_PROJECT_PATH, 'worktrees')}"`, { cwd: TEST_PROJECT_PATH }) } catch { /* ignore */ }

    // Create worktree again
    await mainWindow.getByRole('button', { name: /Add Worktree/ }).click()
    await mainWindow.waitForTimeout(2000)

    // Verify branch was actually created in git
    const branches = execSync('git branch', { cwd: TEST_PROJECT_PATH }).toString()
    expect(branches).toContain(branchName)

    // Verify worktree dir exists on disk
    const worktreePath = path.join(TEST_PROJECT_PATH, 'worktrees', branchName)
    const exists = require('fs').existsSync(worktreePath)
    expect(exists).toBe(true)
  })
})
