import { execSync } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'
import path from 'path'
import { recordDiagnosticEvent } from '@slayzone/diagnostics/main'
import type { ConflictFileContent, DetectedWorktree, GitDiffSnapshot, MergeResult } from '../shared/types'

function trimOutput(value: unknown, maxLength = 1200): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  if (!normalized) return null
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength)}...[trimmed:${normalized.length - maxLength}]`
}

function extractExecErrorDetails(error: unknown): {
  message: string
  exitCode: number | null
  stderr: string | null
  stdout: string | null
} {
  const raw = error as {
    message?: string
    status?: number
    stderr?: unknown
    stdout?: unknown
  }

  const stderr = Buffer.isBuffer(raw.stderr)
    ? trimOutput(raw.stderr.toString('utf8'))
    : trimOutput(raw.stderr)
  const stdout = Buffer.isBuffer(raw.stdout)
    ? trimOutput(raw.stdout.toString('utf8'))
    : trimOutput(raw.stdout)

  return {
    message: raw.message ?? String(error),
    exitCode: typeof raw.status === 'number' ? raw.status : null,
    stderr,
    stdout
  }
}

function execGit(command: string, options: Parameters<typeof execSync>[1] & { cwd: string }): string | Buffer {
  const startedAt = Date.now()
  try {
    const result = execSync(command, {
      stdio: ['pipe', 'pipe', 'pipe'],
      ...options
    })
    recordDiagnosticEvent({
      level: 'info',
      source: 'git',
      event: 'git.command',
      message: command,
      payload: {
        command,
        cwd: options.cwd,
        durationMs: Date.now() - startedAt,
        success: true
      }
    })
    return result
  } catch (error) {
    const details = extractExecErrorDetails(error)
    recordDiagnosticEvent({
      level: 'error',
      source: 'git',
      event: 'git.command_failed',
      message: details.message,
      payload: {
        command,
        cwd: options.cwd,
        durationMs: Date.now() - startedAt,
        success: false,
        exitCode: details.exitCode,
        stderr: details.stderr,
        stdout: details.stdout
      }
    })
    throw error
  }
}

export function isGitRepo(path: string): boolean {
  try {
    execGit('git rev-parse --git-dir', { cwd: path })
    return true
  } catch {
    return false
  }
}

export function detectWorktrees(repoPath: string): DetectedWorktree[] {
  try {
    const output = execGit('git worktree list --porcelain', {
      cwd: repoPath,
      encoding: 'utf-8'
    }) as string

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
  execGit(`git worktree add ${args.map(a => `"${a}"`).join(' ')}`, { cwd: repoPath })
}

export function removeWorktree(repoPath: string, worktreePath: string): void {
  execGit(`git worktree remove "${worktreePath}" --force`, { cwd: repoPath })
}

export function initRepo(path: string): void {
  execGit('git init', { cwd: path })
}

export function getCurrentBranch(path: string): string | null {
  try {
    const output = execGit('git branch --show-current', {
      cwd: path,
      encoding: 'utf-8'
    }) as string
    return output.trim() || null
  } catch {
    return null
  }
}

export function hasUncommittedChanges(path: string): boolean {
  try {
    // -uno: ignore untracked files — they don't block git merge
    const output = execGit('git status --porcelain -uno', {
      cwd: path,
      encoding: 'utf-8'
    }) as string
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
      execGit(`git checkout "${parentBranch}"`, { cwd: projectPath })
    }

    // Attempt merge
    try {
      execGit(`git merge "${sourceBranch}" --no-ff --no-edit`, { cwd: projectPath })
      return { success: true, merged: true, conflicted: false }
    } catch {
      // Check for merge conflicts
      const status = execGit('git status --porcelain', {
        cwd: projectPath,
        encoding: 'utf-8'
      }) as string
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
  execGit('git merge --abort', { cwd: path })
}

export function getConflictedFiles(path: string): string[] {
  try {
    const output = execGit('git diff --name-only --diff-filter=U', {
      cwd: path,
      encoding: 'utf-8'
    }) as string
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
      execGit(`git checkout "${parentBranch}"`, { cwd: projectPath })
    } catch (err) {
      const msg = err instanceof Error && 'stderr' in err ? String((err as { stderr: unknown }).stderr) : String(err)
      throw new Error(`Cannot checkout ${parentBranch}: ${msg.trim()}`)
    }
  }

  // Attempt merge with --no-commit
  try {
    execGit(`git merge "${sourceBranch}" --no-commit --no-ff`, { cwd: projectPath })
    // Clean merge - commit it
    execGit(`git commit --no-edit`, { cwd: projectPath })
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
    execGit('git rev-parse --verify MERGE_HEAD', { cwd: path })
    return true
  } catch {
    return false
  }
}

export function stageFile(path: string, filePath: string): void {
  execGit(`git add -- "${filePath}"`, { cwd: path })
}

export function unstageFile(path: string, filePath: string): void {
  execGit(`git reset HEAD -- "${filePath}"`, { cwd: path })
}

export function stageAll(path: string): void {
  execGit('git add -A', { cwd: path })
}

export function unstageAll(path: string): void {
  execGit('git reset HEAD', { cwd: path })
}

export function getUntrackedFileDiff(repoPath: string, filePath: string): string {
  try {
    return execGit(`git diff --no-index --no-ext-diff -- /dev/null "${filePath}"`, {
      cwd: repoPath,
      encoding: 'utf-8'
    }) as string
  } catch (err: unknown) {
    // git diff --no-index exits with code 1 when files differ — expected
    const e = err as { stdout?: string }
    if (e.stdout) return e.stdout
    throw err
  }
}

export function getWorkingDiff(path: string): GitDiffSnapshot {
  try {
    execGit('git rev-parse --git-dir', { cwd: path })
  } catch {
    throw new Error(`Not a git repository: ${path}`)
  }

  const unstagedFilesRaw = execGit('git diff --name-only', {
    cwd: path,
    encoding: 'utf-8'
  }) as string
  const stagedFilesRaw = execGit('git diff --cached --name-only', {
    cwd: path,
    encoding: 'utf-8'
  }) as string
  const untrackedFilesRaw = execGit('git ls-files --others --exclude-standard', {
    cwd: path,
    encoding: 'utf-8'
  }) as string
  const unstagedPatch = execGit('git diff --no-ext-diff', {
    cwd: path,
    encoding: 'utf-8'
  }) as string
  const stagedPatch = execGit('git diff --cached --no-ext-diff', {
    cwd: path,
    encoding: 'utf-8'
  }) as string

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

export function getConflictContent(repoPath: string, filePath: string): ConflictFileContent {
  const gitShow = (stage: string): string | null => {
    try {
      return execGit(`git show ${stage}:"${filePath}"`, {
        cwd: repoPath,
        encoding: 'utf-8'
      }) as string
    } catch {
      return null
    }
  }

  let merged: string | null = null
  try {
    merged = readFileSync(path.join(repoPath, filePath), 'utf-8')
  } catch {
    // File may have been deleted
  }

  return {
    path: filePath,
    base: gitShow(':1'),
    ours: gitShow(':2'),
    theirs: gitShow(':3'),
    merged
  }
}

export function writeResolvedFile(repoPath: string, filePath: string, content: string): void {
  writeFileSync(path.join(repoPath, filePath), content, 'utf-8')
}

export function commitFiles(repoPath: string, message: string): void {
  execGit(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: repoPath })
}
