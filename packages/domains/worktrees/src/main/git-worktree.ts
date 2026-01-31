import { execSync } from 'child_process'
import type { DetectedWorktree } from '../shared/types'

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
