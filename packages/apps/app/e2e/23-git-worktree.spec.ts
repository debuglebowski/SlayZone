import { test, expect, seed, goHome, clickProject } from './fixtures/electron'
import { TEST_PROJECT_PATH } from './fixtures/electron'
import { execSync } from 'child_process'
import path from 'path'

test.describe('Git worktree operations', () => {
  let projectAbbrev: string
  let taskId: string
  const branchName = 'worktree-task' // slugify('Worktree task')

  const getTask = async (page: import('@playwright/test').Page, id: string) =>
    page.evaluate((taskId) => window.api.db.getTask(taskId), id)

  const openTaskViaSearch = async (
    page: import('@playwright/test').Page,
    title: string
  ) => {
    await page.keyboard.press('Meta+k')
    const input = page.getByPlaceholder('Search tasks and projects...')
    await expect(input).toBeVisible()
    await input.fill(title)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(500)
  }

  const removeWorktreeButton = (page: import('@playwright/test').Page) => {
    const gitPanel = page.getByTestId('task-git-panel').last()
    return gitPanel.locator('button:has(svg.lucide-trash-2)').first()
  }

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

    // Clean up any leftover worktrees from previous runs.
    try {
      const mainWorktree = execSync('git rev-parse --show-toplevel', { cwd: TEST_PROJECT_PATH }).toString().trim()
      const worktreeList = execSync('git worktree list --porcelain', { cwd: TEST_PROJECT_PATH }).toString()
      const worktreePaths = worktreeList
        .split('\n')
        .filter(line => line.startsWith('worktree '))
        .map(line => line.replace('worktree ', '').trim())

      for (const wt of worktreePaths) {
        if (wt !== mainWorktree) {
          try { execSync(`git worktree remove --force "${wt}"`, { cwd: TEST_PROJECT_PATH }) } catch { /* ignore */ }
        }
      }
      execSync('git worktree prune', { cwd: TEST_PROJECT_PATH })
      const worktreeDir = path.join(TEST_PROJECT_PATH, 'worktrees')
      execSync(`rm -rf "${worktreeDir}"`, { cwd: TEST_PROJECT_PATH })
    } catch { /* ignore */ }

    // Delete branch if it exists from a previous run
    try { execSync(`git branch -D ${branchName}`, { cwd: TEST_PROJECT_PATH }) } catch { /* ignore */ }

    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'Worktree Test', color: '#10b981', path: TEST_PROJECT_PATH })
    // Ensure default worktree base path behavior is used for this suite.
    await s.setSetting('worktree_base_path', '')
    projectAbbrev = p.name.slice(0, 2).toUpperCase()
    const t = await s.createTask({ projectId: p.id, title: 'Worktree task', status: 'todo' })
    taskId = t.id
    await s.refreshData()

    await goHome(mainWindow)
    await clickProject(mainWindow, projectAbbrev)
    await mainWindow.waitForTimeout(500)
    await openTaskViaSearch(mainWindow, 'Worktree task')
  })

  test('git panel shows current branch', async ({ mainWindow }) => {
    // Settings panel is visible by default — GitPanel should show branch
    const gitPanel = mainWindow.getByTestId('task-git-panel').last()
    await expect(gitPanel).toBeVisible()
    await expect(gitPanel.getByText('Git').first()).toBeVisible()
    // Should show main or master
    const branchText = gitPanel.locator('text=/main|master/')
    await expect(branchText.first()).toBeVisible()
  })

  test('shows Add Worktree button when no worktree', async ({ mainWindow }) => {
    await expect(mainWindow.getByRole('button', { name: /Add Worktree/ })).toBeVisible()
  })

  test('create worktree', async ({ mainWindow }) => {
    await mainWindow.getByRole('button', { name: /Add Worktree/ }).click()
    // Wait for creation (git worktree add + DB update)
    await expect
      .poll(async () => {
        const task = await getTask(mainWindow, taskId)
        return task?.worktree_path ?? null
      })
      .toContain(branchName)

    // Worktree name should appear (derived from slugified task title)
    await expect(mainWindow.getByText(branchName)).toBeVisible()
  })

  test('worktree shows parent branch', async ({ mainWindow }) => {
    // "from main" or "from master"
    const gitPanel = mainWindow.getByTestId('task-git-panel').last()
    const fromBranch = gitPanel.locator('text=/from\\s+(main|master)/i')
    await expect(fromBranch.first()).toBeVisible({ timeout: 10_000 })
  })

  test('worktree path persisted in DB', async ({ mainWindow }) => {
    await expect
      .poll(async () => {
        const task = await getTask(mainWindow, taskId)
        return {
          worktreePath: task?.worktree_path ?? null,
          parent: task?.worktree_parent_branch ?? null,
        }
      })
      .toMatchObject({
        worktreePath: expect.stringContaining(branchName),
        parent: expect.stringMatching(/main|master/),
      })
  })

  test('merge button visible', async ({ mainWindow }) => {
    const gitPanel = mainWindow.getByTestId('task-git-panel').last()
    const mergeBtn = gitPanel.getByRole('button', { name: /Merge into/ })
    await expect(mergeBtn).toBeVisible({ timeout: 10_000 })
  })

  test('remove worktree button visible', async ({ mainWindow }) => {
    await expect(removeWorktreeButton(mainWindow)).toBeVisible()
  })

  test('delete worktree', async ({ mainWindow }) => {
    await removeWorktreeButton(mainWindow).click()
    await expect
      .poll(async () => {
        const task = await getTask(mainWindow, taskId)
        return task?.worktree_path ?? null
      })
      .toBeNull()

    // Add Worktree button should reappear
    await expect(mainWindow.getByRole('button', { name: /Add Worktree/ })).toBeVisible({ timeout: 10_000 })
  })

  test('worktree path cleared in DB after delete', async ({ mainWindow }) => {
    const task = await getTask(mainWindow, taskId)
    expect(task?.worktree_path).toBeNull()
  })

  test('create and verify branch exists in git', async ({ mainWindow }) => {
    // Clean up branch from previous create/delete cycle
    try { execSync(`git branch -D ${branchName}`, { cwd: TEST_PROJECT_PATH }) } catch { /* ignore */ }
    try { execSync('git worktree prune', { cwd: TEST_PROJECT_PATH }) } catch { /* ignore */ }
    try { execSync(`rm -rf "${path.join(TEST_PROJECT_PATH, 'worktrees')}"`, { cwd: TEST_PROJECT_PATH }) } catch { /* ignore */ }

    // Ensure task is in "no worktree" state before re-creating.
    if (!(await mainWindow.getByRole('button', { name: /Add Worktree/ }).isVisible().catch(() => false))) {
      if (await removeWorktreeButton(mainWindow).isVisible().catch(() => false)) {
        await removeWorktreeButton(mainWindow).click()
      }
      await expect
        .poll(async () => {
          const task = await getTask(mainWindow, taskId)
          return task?.worktree_path ?? null
        })
        .toBeNull()
      await expect(mainWindow.getByRole('button', { name: /Add Worktree/ })).toBeVisible({ timeout: 10_000 })
    }

    // Create worktree again
    await mainWindow.getByRole('button', { name: /Add Worktree/ }).click()
    await expect
      .poll(async () => {
        const task = await getTask(mainWindow, taskId)
        return task?.worktree_path ?? null
      })
      .toContain(branchName)

    // Verify branch was actually created in git
    await expect
      .poll(() => execSync('git branch', { cwd: TEST_PROJECT_PATH }).toString())
      .toContain(branchName)

    // Verify default template behavior: {project}/.. resolves to project parent.
    const task = await getTask(mainWindow, taskId)
    const worktreePathFromDb = task?.worktree_path ?? ''
    const expectedWorktreePath = path.join(path.dirname(TEST_PROJECT_PATH), branchName)
    expect(worktreePathFromDb).toBe(expectedWorktreePath)

    // Verify worktree dir exists on disk (read effective path from DB)
    const worktreePath = task?.worktree_path ?? path.join(TEST_PROJECT_PATH, 'worktrees', branchName)
    const exists = require('fs').existsSync(worktreePath)
    expect(exists).toBe(true)
  })

  test('archiving a task removes its worktree from git and disk', async ({ mainWindow }) => {
    const s = seed(mainWindow)
    const projects = await s.getProjects()
    const project = projects.find((p: { name: string }) => p.name === 'Worktree Test')
    expect(project).toBeTruthy()

    const suffix = Date.now().toString()
    const branch = `archive-cleanup-${suffix}`
    const title = `Archive cleanup ${suffix}`
    const created = await s.createTask({ projectId: project!.id, title, status: 'todo' })
    const worktreePath = path.join(path.dirname(TEST_PROJECT_PATH), branch)
    const parentBranch = execSync('git branch --show-current', { cwd: TEST_PROJECT_PATH }).toString().trim()

    await mainWindow.evaluate(async ({ repoPath, targetPath, branch, taskId, parentBranch }) => {
      await window.api.git.createWorktree(repoPath, targetPath, branch)
      await window.api.db.updateTask({
        id: taskId,
        worktreePath: targetPath,
        worktreeParentBranch: parentBranch
      })
    }, { repoPath: TEST_PROJECT_PATH, targetPath: worktreePath, branch, taskId: created.id, parentBranch })

    await expect
      .poll(() => execSync('git worktree list --porcelain', { cwd: TEST_PROJECT_PATH }).toString())
      .toContain(worktreePath)
    expect(require('fs').existsSync(worktreePath)).toBe(true)

    await s.archiveTask(created.id)

    await expect
      .poll(async () => {
        const archived = await getTask(mainWindow, created.id)
        return {
          archivedAt: archived?.archived_at ?? null,
          worktreePath: archived?.worktree_path ?? null
        }
      })
      .toMatchObject({
        archivedAt: expect.any(String),
        worktreePath: null
      })

    await expect
      .poll(() => execSync('git worktree list --porcelain', { cwd: TEST_PROJECT_PATH }).toString())
      .not.toContain(worktreePath)
    await expect
      .poll(() => require('fs').existsSync(worktreePath))
      .toBe(false)
  })

  test('deleting a task removes its worktree from git and disk', async ({ mainWindow }) => {
    const s = seed(mainWindow)
    const projects = await s.getProjects()
    const project = projects.find((p: { name: string }) => p.name === 'Worktree Test')
    expect(project).toBeTruthy()

    const suffix = Date.now().toString()
    const branch = `delete-cleanup-${suffix}`
    const title = `Delete cleanup ${suffix}`
    const created = await s.createTask({ projectId: project!.id, title, status: 'todo' })
    const worktreePath = path.join(path.dirname(TEST_PROJECT_PATH), branch)
    const parentBranch = execSync('git branch --show-current', { cwd: TEST_PROJECT_PATH }).toString().trim()

    await mainWindow.evaluate(async ({ repoPath, targetPath, branch, taskId, parentBranch }) => {
      await window.api.git.createWorktree(repoPath, targetPath, branch)
      await window.api.db.updateTask({
        id: taskId,
        worktreePath: targetPath,
        worktreeParentBranch: parentBranch
      })
    }, { repoPath: TEST_PROJECT_PATH, targetPath: worktreePath, branch, taskId: created.id, parentBranch })

    await expect
      .poll(() => execSync('git worktree list --porcelain', { cwd: TEST_PROJECT_PATH }).toString())
      .toContain(worktreePath)
    expect(require('fs').existsSync(worktreePath)).toBe(true)

    await s.deleteTask(created.id)

    await expect
      .poll(async () => {
        const deleted = await getTask(mainWindow, created.id)
        return deleted
      })
      .toBeNull()

    await expect
      .poll(() => execSync('git worktree list --porcelain', { cwd: TEST_PROJECT_PATH }).toString())
      .not.toContain(worktreePath)
    await expect
      .poll(() => require('fs').existsSync(worktreePath))
      .toBe(false)
  })
})
