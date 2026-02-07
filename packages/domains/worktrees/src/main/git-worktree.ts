import { execSync } from 'child_process'
import type { DetectedWorktree, GitDiffSnapshot, MergeResult } from '../shared/types'

export function isGitRepo(path: string): boolean {
  try {
    execSync('git rev-parse --git-dir', { cwd: path, stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

export function detectWorktrees(repoPath: string): DetectedWorktree[] {
  try {
    const output = execSync('git worktree list --porcelain', {
      cwd: repoPath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    })

    const worktrees: DetectedWorktree[] = []
    let current: Partial<DetectedWorktree> = {}

    for (const line of output.split('\n')) {
      if (line.startsWith('worktree ')) {
        if (current.path) {
          worktrees.push(current as DetectedWorktree)
        }
        current = { path: line.slice(9), isMain: false }
      } else if (line.startsWith('branch refs/heads/')) {
        current.branch = line.slice(18)
      } else if (line === 'bare') {
        current.isMain = true
      } else if (line === '') {
        // Empty line marks end of worktree entry
        if (current.path) {
          // First worktree is typically the main one
          if (worktrees.length === 0) {
            current.isMain = true
          }
          worktrees.push({
            path: current.path,
            branch: current.branch ?? null,
            isMain: current.isMain ?? false
          })
          current = {}
        }
      }
    }

    // Handle last entry if no trailing newline
    if (current.path) {
      worktrees.push({
        path: current.path,
        branch: current.branch ?? null,
        isMain: current.isMain ?? false
      })
    }

    return worktrees
  } catch {
    return []
  }
}

export function createWorktree(repoPath: string, targetPath: string, branch?: string): void {
  const args = branch ? [targetPath, '-b', branch] : [targetPath]
  execSync(`git worktree add ${args.map(a => `"${a}"`).join(' ')}`, {
    cwd: repoPath,
    stdio: 'pipe'
  })
}

export function removeWorktree(repoPath: string, worktreePath: string): void {
  execSync(`git worktree remove "${worktreePath}" --force`, {
    cwd: repoPath,
    stdio: 'pipe'
  })
}

export function initRepo(path: string): void {
  execSync('git init', { cwd: path, stdio: 'pipe' })
}

export function getCurrentBranch(path: string): string | null {
  try {
    const output = execSync('git branch --show-current', {
      cwd: path,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    })
    return output.trim() || null
  } catch {
    return null
  }
}

export function hasUncommittedChanges(path: string): boolean {
  try {
    const output = execSync('git status --porcelain', {
      cwd: path,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    })
    return output.trim().length > 0
  } catch {
    return false
  }
}

export function mergeIntoParent(
  projectPath: string,
  parentBranch: string,
  sourceBranch: string
): MergeResult {
  try {
    // Check if we're on parent branch, if not checkout
    const currentBranch = getCurrentBranch(projectPath)
    if (currentBranch !== parentBranch) {
      execSync(`git checkout "${parentBranch}"`, {
        cwd: projectPath,
        stdio: 'pipe'
      })
    }

    // Attempt merge
    try {
      execSync(`git merge "${sourceBranch}" --no-ff --no-edit`, {
        cwd: projectPath,
        stdio: 'pipe'
      })
      return { success: true, merged: true, conflicted: false }
    } catch {
      // Check for merge conflicts
      const status = execSync('git status --porcelain', {
        cwd: projectPath,
        encoding: 'utf-8'
      })
      if (status.includes('UU') || status.includes('AA') || status.includes('DD')) {
        return { success: false, merged: false, conflicted: true, error: 'Merge conflicts detected' }
      }
      throw new Error('Merge failed')
    }
  } catch (err) {
    return {
      success: false,
      merged: false,
      conflicted: false,
      error: err instanceof Error ? err.message : String(err)
    }
  }
}

export function abortMerge(path: string): void {
  execSync('git merge --abort', { cwd: path, stdio: 'pipe' })
}

export function getConflictedFiles(path: string): string[] {
  try {
    const output = execSync('git diff --name-only --diff-filter=U', {
      cwd: path,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    })
    return output.trim().split('\n').filter(Boolean)
  } catch {
    return []
  }
}

export function startMergeNoCommit(
  projectPath: string,
  parentBranch: string,
  sourceBranch: string
): { clean: boolean; conflictedFiles: string[] } {
  // Checkout parent branch
  const currentBranch = getCurrentBranch(projectPath)
  if (currentBranch !== parentBranch) {
    try {
      execSync(`git checkout "${parentBranch}"`, {
        cwd: projectPath,
        stdio: 'pipe'
      })
    } catch (err) {
      const msg = err instanceof Error && 'stderr' in err ? String((err as { stderr: unknown }).stderr) : String(err)
      throw new Error(`Cannot checkout ${parentBranch}: ${msg.trim()}`)
    }
  }

  // Attempt merge with --no-commit
  try {
    execSync(`git merge "${sourceBranch}" --no-commit --no-ff`, {
      cwd: projectPath,
      stdio: 'pipe'
    })
    // Clean merge - commit it
    execSync(`git commit --no-edit`, {
      cwd: projectPath,
      stdio: 'pipe'
    })
    return { clean: true, conflictedFiles: [] }
  } catch (err) {
    // Check for conflicts
    const conflictedFiles = getConflictedFiles(projectPath)
    if (conflictedFiles.length > 0) {
      return { clean: false, conflictedFiles }
    }
    // Some other error - include the actual message
    const msg = err instanceof Error && 'stderr' in err ? String((err as { stderr: unknown }).stderr) : String(err)
    throw new Error(`Merge failed: ${msg.trim()}`)
  }
}

export function isMergeInProgress(path: string): boolean {
  try {
    execSync('git rev-parse --verify MERGE_HEAD', {
      cwd: path,
      stdio: 'pipe'
    })
    return true
  } catch {
    return false
  }
}

export function stageFile(path: string, filePath: string): void {
  execSync(`git add -- "${filePath}"`, { cwd: path, stdio: 'pipe' })
}

export function unstageFile(path: string, filePath: string): void {
  execSync(`git reset HEAD -- "${filePath}"`, { cwd: path, stdio: 'pipe' })
}

export function getWorkingDiff(path: string): GitDiffSnapshot {
  try {
    execSync('git rev-parse --git-dir', { cwd: path, stdio: 'pipe' })
  } catch {
    throw new Error(`Not a git repository: ${path}`)
  }

  const unstagedFilesRaw = execSync('git diff --name-only', {
    cwd: path,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe']
  })
  const stagedFilesRaw = execSync('git diff --cached --name-only', {
    cwd: path,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe']
  })
  const untrackedFilesRaw = execSync('git ls-files --others --exclude-standard', {
    cwd: path,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe']
  })
  const unstagedPatch = execSync('git diff --no-ext-diff', {
    cwd: path,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe']
  })
  const stagedPatch = execSync('git diff --cached --no-ext-diff', {
    cwd: path,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe']
  })

  const unstagedFiles = unstagedFilesRaw.trim().split('\n').filter(Boolean)
  const stagedFiles = stagedFilesRaw.trim().split('\n').filter(Boolean)
  const untrackedFiles = untrackedFilesRaw.trim().split('\n').filter(Boolean)

  return {
    targetPath: path,
    files: [...new Set([...unstagedFiles, ...stagedFiles, ...untrackedFiles])].sort(),
    stagedFiles: stagedFiles.sort(),
    unstagedFiles: unstagedFiles.sort(),
    untrackedFiles: untrackedFiles.sort(),
    unstagedPatch,
    stagedPatch,
    generatedAt: new Date().toISOString(),
    isGitRepo: true
  }
}
