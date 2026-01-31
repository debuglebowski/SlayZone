import type { IpcMain } from 'electron'
import { isGitRepo, detectWorktrees, createWorktree, removeWorktree, initRepo, getCurrentBranch } from './git-worktree'

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
}
