import { randomUUID } from 'node:crypto'
import { realpathSync } from 'node:fs'
import type { Database } from 'better-sqlite3'
import type { AgentEvent } from '@slayzone/terminal/shared'
import { snapshotWorktree, deleteTurnRef } from './git-snapshot'
import {
  insertTurn,
  deleteTurn,
  getLatestTurnForWorktree,
  findTurnsToPrune,
} from './db'

/** Canonical worktree path: realpath when possible, fall back to raw path. */
function canonical(p: string): string {
  try {
    return realpathSync(p)
  } catch {
    return p
  }
}

/**
 * Lookup task_id + git repo path for a chat tab. Falls back to project.path
 * when task.worktree_path is empty. Returns null if no usable repo path.
 */
function resolveTabContext(
  db: Database,
  tabId: string
): { taskId: string; worktreePath: string } | null {
  const tab = db.prepare(`SELECT task_id FROM terminal_tabs WHERE id = ?`).get(tabId) as
    | { task_id: string }
    | undefined
  if (!tab) return null
  const row = db
    .prepare(
      `SELECT t.worktree_path, p.path AS project_path
       FROM tasks t LEFT JOIN projects p ON p.id = t.project_id
       WHERE t.id = ?`
    )
    .get(tab.task_id) as { worktree_path: string | null; project_path: string | null } | undefined
  if (!row) return null
  const repoPath = row.worktree_path || row.project_path
  if (!repoPath) return null
  return { taskId: tab.task_id, worktreePath: canonical(repoPath) }
}

function broadcastChange(worktreePath: string): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { BrowserWindow } = require('electron') as typeof import('electron')
    for (const w of BrowserWindow.getAllWindows()) {
      if (w.isDestroyed()) continue
      w.webContents.send('agent-turns:changed', worktreePath)
    }
  } catch {
    // non-electron context (tests) — no-op
  }
}

/**
 * Record a turn boundary. Snapshots the worktree, dedupes against the prev
 * snapshot for the same worktree, prunes oldest beyond cap. Stores task_id
 * for attribution but groups by worktree_path.
 */
export async function recordTurnBoundary(
  db: Database,
  tabId: string,
  promptText: string
): Promise<void> {
  const ctx = resolveTabContext(db, tabId)
  if (!ctx) return
  const id = randomUUID()
  const sha = await snapshotWorktree(ctx.worktreePath, id)
  if (!sha) return

  const prev = getLatestTurnForWorktree(db, ctx.worktreePath)
  if (prev && prev.snapshot_sha === sha) {
    await deleteTurnRef(ctx.worktreePath, id)
    return
  }

  try {
    insertTurn(db, {
      id,
      worktree_path: ctx.worktreePath,
      task_id: ctx.taskId,
      terminal_tab_id: tabId,
      snapshot_sha: sha,
      prompt_preview: promptText.replace(/\s+/g, ' ').trim().slice(0, 200),
      created_at: Date.now(),
    })
  } catch (err) {
    console.error('[turn-tracker] insertTurn failed:', err)
    await deleteTurnRef(ctx.worktreePath, id)
    return
  }

  // Prune oldest beyond cap (per worktree).
  const stale = findTurnsToPrune(db, ctx.worktreePath)
  for (const sid of stale) {
    deleteTurn(db, sid)
    await deleteTurnRef(ctx.worktreePath, sid)
  }

  broadcastChange(ctx.worktreePath)
}

/**
 * Chat-mode entrypoint: pair `user-message` → `result`. Use the captured
 * user prompt as `prompt_preview`.
 */
export function initChatTurnSubscriber(db: Database): (tabId: string, event: AgentEvent) => void {
  const lastUserPromptByTab = new Map<string, string>()
  return (tabId, event) => {
    if (event.kind === 'user-message') {
      lastUserPromptByTab.set(tabId, event.text ?? '')
      return
    }
    if (event.kind === 'result') {
      const prompt = lastUserPromptByTab.get(tabId) ?? ''
      lastUserPromptByTab.delete(tabId)
      void recordTurnBoundary(db, tabId, prompt).catch((err) => {
        console.error('[turn-tracker] recordTurnBoundary (chat) failed:', err)
      })
    }
  }
}

/**
 * xterm-mode entrypoint: each Enter press in an AGENT-mode PTY (claude-code,
 * codex, gemini, etc.) is a turn boundary. Plain shell tabs are skipped.
 */
export function initPtyTurnSubscriber(
  db: Database
): (sessionId: string, taskId: string, line: string) => void {
  return (sessionId, taskId, line) => {
    const trimmed = line.trim()
    if (!trimmed) return
    const parts = sessionId.split(':')
    const tabId = parts.length > 1 ? parts.slice(1).join(':') : taskId
    const tabMode = db.prepare(`SELECT mode FROM terminal_tabs WHERE id = ?`).get(tabId) as
      | { mode: string }
      | undefined
    if (!tabMode || tabMode.mode === 'terminal') return
    void recordTurnBoundary(db, tabId, trimmed).catch((err) => {
      console.error('[turn-tracker] recordTurnBoundary (pty) failed:', err)
    })
  }
}
