import type { IpcMain } from 'electron'
import {
  isGitRepo,
  detectWorktrees,
  createWorktree,
  removeWorktree,
  initRepo,
  getCurrentBranch,
  hasUncommittedChanges,
  mergeIntoParent,
  abortMerge,
  startMergeNoCommit,
  isMergeInProgress,
  getConflictedFiles,
  getWorkingDiff,
  stageFile,
  unstageFile
} from './git-worktree'
import type { MergeWithAIResult } from '../shared/types'

export function registerWorktreeHandlers(ipcMain: IpcMain): void {
  // Git operations
  ipcMain.handle('git:isGitRepo', (_, path: string) => {
    return isGitRepo(path)
  })

  ipcMain.handle('git:detectWorktrees', (_, repoPath: string) => {
    return detectWorktrees(repoPath)
  })

  ipcMain.handle('git:createWorktree', (_, repoPath: string, targetPath: string, branch?: string) => {
    createWorktree(repoPath, targetPath, branch)
  })

  ipcMain.handle('git:removeWorktree', (_, repoPath: string, worktreePath: string) => {
    removeWorktree(repoPath, worktreePath)
  })

  ipcMain.handle('git:init', (_, path: string) => {
    initRepo(path)
  })

  ipcMain.handle('git:getCurrentBranch', (_, path: string) => {
    return getCurrentBranch(path)
  })

  ipcMain.handle('git:hasUncommittedChanges', (_, path: string) => {
    return hasUncommittedChanges(path)
  })

  ipcMain.handle('git:mergeIntoParent', (_, projectPath: string, parentBranch: string, sourceBranch: string) => {
    return mergeIntoParent(projectPath, parentBranch, sourceBranch)
  })

  ipcMain.handle('git:abortMerge', (_, path: string) => {
    abortMerge(path)
  })

  ipcMain.handle(
    'git:mergeWithAI',
    (_, projectPath: string, worktreePath: string, parentBranch: string, sourceBranch: string): MergeWithAIResult => {
      try {
        // Check for uncommitted changes in worktree
        const hasChanges = hasUncommittedChanges(worktreePath)

        // Start merge
        const result = startMergeNoCommit(projectPath, parentBranch, sourceBranch)

        // If clean merge and no uncommitted changes, we're done
        if (result.clean && !hasChanges) {
          return { success: true }
        }

        // Build dynamic prompt based on what needs to be done
        const steps: string[] = []

        if (hasChanges) {
          steps.push(`Step 1: Commit uncommitted changes in this worktree
- git add -A
- git commit -m "WIP: changes before merge"`)
        }

        if (result.conflictedFiles.length > 0) {
          const stepNum = hasChanges ? 2 : 1
          steps.push(`Step ${stepNum}: Resolve merge conflicts in ${projectPath}
Conflicted files:
${result.conflictedFiles.map(f => `- ${f}`).join('\n')}

- cd "${projectPath}"
- Read each conflicted file
- Resolve conflicts (prefer source branch when unclear)
- git add <resolved files>
- git commit -m "Merge ${sourceBranch} into ${parentBranch}"`)
        } else if (hasChanges) {
          // No conflicts but has uncommitted changes - after committing, merge should work
          steps.push(`Step 2: Complete the merge
- cd "${projectPath}"
- git merge "${sourceBranch}" --no-ff
- If conflicts occur, resolve them`)
        }

        const prompt = `Complete this merge: "${sourceBranch}" → "${parentBranch}"

${steps.join('\n\n')}`

        return {
          resolving: true,
          conflictedFiles: result.conflictedFiles,
          prompt
        }
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) }
      }
    }
  )

  ipcMain.handle('git:isMergeInProgress', (_, path: string) => {
    return isMergeInProgress(path)
  })

  ipcMain.handle('git:getConflictedFiles', (_, path: string) => {
    return getConflictedFiles(path)
  })

  ipcMain.handle('git:getWorkingDiff', (_, path: string) => {
    return getWorkingDiff(path)
  })

  ipcMain.handle('git:stageFile', (_, path: string, filePath: string) => {
    stageFile(path, filePath)
  })

  ipcMain.handle('git:unstageFile', (_, path: string, filePath: string) => {
    unstageFile(path, filePath)
  })
}
