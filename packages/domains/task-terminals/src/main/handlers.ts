import type { IpcMain } from 'electron'
import type { Database } from 'better-sqlite3'
import type { TerminalTab, CreateTerminalTabInput, UpdateTerminalTabInput } from '../shared/types'

export function registerTerminalTabsHandlers(ipcMain: IpcMain, db: Database): void {
  // List tabs for a task
  ipcMain.handle('tabs:list', (_, taskId: string): TerminalTab[] => {
    const rows = db.prepare(
      'SELECT * FROM terminal_tabs WHERE task_id = ? ORDER BY position ASC'
    ).all(taskId) as Array<{
      id: string
      task_id: string
      label: string | null
      mode: string
      is_main: number
      position: number
      created_at: string
    }>

    return rows.map(row => ({
      id: row.id,
      taskId: row.task_id,
      label: row.label,
      mode: row.mode as TerminalTab['mode'],
      isMain: row.is_main === 1,
      position: row.position,
      createdAt: row.created_at
    }))
  })

  // Create a new tab
  ipcMain.handle('tabs:create', (_, input: CreateTerminalTabInput): TerminalTab => {
    const id = crypto.randomUUID()
    const mode = input.mode || 'terminal'

    // Get next position
    const maxPos = db.prepare(
      'SELECT COALESCE(MAX(position), -1) as max_pos FROM terminal_tabs WHERE task_id = ?'
    ).get(input.taskId) as { max_pos: number }
    const position = maxPos.max_pos + 1

    // Generate auto-label if not provided
    let label = input.label ?? null
    if (!label) {
      const count = db.prepare(
        'SELECT COUNT(*) as count FROM terminal_tabs WHERE task_id = ?'
      ).get(input.taskId) as { count: number }
      // First tab (main) has no label, subsequent tabs get "Terminal 2", etc.
      if (count.count > 0) {
        label = `Terminal ${count.count + 1}`
      }
    }

    const now = new Date().toISOString()
    db.prepare(`
      INSERT INTO terminal_tabs (id, task_id, label, mode, is_main, position, created_at)
      VALUES (?, ?, ?, ?, 0, ?, ?)
    `).run(id, input.taskId, label, mode, position, now)

    return {
      id,
      taskId: input.taskId,
      label,
      mode: mode as TerminalTab['mode'],
      isMain: false,
      position,
      createdAt: now
    }
  })

  // Update a tab
  ipcMain.handle('tabs:update', (_, input: UpdateTerminalTabInput): TerminalTab | null => {
    const existing = db.prepare('SELECT * FROM terminal_tabs WHERE id = ?').get(input.id) as {
      id: string
      task_id: string
      label: string | null
      mode: string
      is_main: number
      position: number
      created_at: string
    } | undefined

    if (!existing) return null

    const mode = input.mode ?? existing.mode

    db.prepare(`
      UPDATE terminal_tabs
      SET label = COALESCE(?, label),
          mode = ?,
          position = COALESCE(?, position)
      WHERE id = ?
    `).run(
      input.label !== undefined ? input.label : null,
      mode,
      input.position,
      input.id
    )

    const updated = db.prepare('SELECT * FROM terminal_tabs WHERE id = ?').get(input.id) as {
      id: string
      task_id: string
      label: string | null
      mode: string
      is_main: number
      position: number
      created_at: string
    }

    return {
      id: updated.id,
      taskId: updated.task_id,
      label: updated.label,
      mode: updated.mode as TerminalTab['mode'],
      isMain: updated.is_main === 1,
      position: updated.position,
      createdAt: updated.created_at
    }
  })

  // Delete a tab (reject if main)
  ipcMain.handle('tabs:delete', (_, tabId: string): boolean => {
    const tab = db.prepare('SELECT is_main FROM terminal_tabs WHERE id = ?').get(tabId) as { is_main: number } | undefined
    if (!tab) return false
    if (tab.is_main === 1) return false // Can't delete main tab

    db.prepare('DELETE FROM terminal_tabs WHERE id = ?').run(tabId)
    return true
  })

  // Ensure main tab exists for a task (creates if missing)
  ipcMain.handle('tabs:ensureMain', (_, taskId: string, mode: string): TerminalTab => {
    const existing = db.prepare(
      'SELECT * FROM terminal_tabs WHERE task_id = ? AND is_main = 1'
    ).get(taskId) as {
      id: string
      task_id: string
      label: string | null
      mode: string
      is_main: number
      position: number
      created_at: string
    } | undefined

    if (existing) {
      // Update mode if it changed (e.g. user switched terminal mode on task)
      if (existing.mode !== mode) {
        db.prepare('UPDATE terminal_tabs SET mode = ? WHERE id = ?').run(mode, existing.id)
        existing.mode = mode
      }
      return {
        id: existing.id,
        taskId: existing.task_id,
        label: existing.label,
        mode: existing.mode as TerminalTab['mode'],
        isMain: true,
        position: existing.position,
        createdAt: existing.created_at
      }
    }

    // Create main tab - use taskId as id (unique since one main per task)
    const now = new Date().toISOString()
    db.prepare(`
      INSERT INTO terminal_tabs (id, task_id, label, mode, is_main, position, created_at)
      VALUES (?, ?, NULL, ?, 1, 0, ?)
    `).run(taskId, taskId, mode, now)

    return {
      id: taskId,
      taskId,
      label: null,
      mode: mode as TerminalTab['mode'],
      isMain: true,
      position: 0,
      createdAt: now
    }
  })
}
