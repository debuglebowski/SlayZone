import type { IpcMain } from 'electron'
import type { Database } from 'better-sqlite3'
import { realpathSync } from 'node:fs'
import { listTurnsForWorktree } from './db'

function canonical(p: string): string {
  try { return realpathSync(p) } catch { return p }
}

export function registerAgentTurnsHandlers(ipcMain: IpcMain, db: Database): void {
  ipcMain.handle('agent-turns:list', (_, worktreePath: string) => {
    if (!worktreePath) return []
    return listTurnsForWorktree(db, canonical(worktreePath))
  })
}
