import type { IpcMain } from 'electron'
import type { Database } from 'better-sqlite3'
import type { CreateTaskInput, UpdateTaskInput, Task } from '@omgslayzone/task/shared'
import { removeWorktree } from '@omgslayzone/worktrees/main'
import { killPtysByTaskId } from '@omgslayzone/terminal/main'

// Parse JSON columns from DB row
function parseTask(row: Record<string, unknown> | undefined): Task | null {
  if (!row) return null
  return {
    ...row,
    panel_visibility: row.panel_visibility
      ? JSON.parse(row.panel_visibility as string)
      : null,
    browser_tabs: row.browser_tabs
      ? JSON.parse(row.browser_tabs as string)
      : null
  } as Task
}

function parseTasks(rows: Record<string, unknown>[]): Task[] {
  return rows.map((row) => parseTask(row)!)
}

function cleanupTask(db: Database, taskId: string): void {
  const task = db.prepare(
    'SELECT worktree_path, project_id, terminal_mode FROM tasks WHERE id = ?'
  ).get(taskId) as { worktree_path: string | null; project_id: string; terminal_mode: string | null } | undefined

  if (!task) return

  killPtysByTaskId(taskId)

  // Remove worktree if exists
  if (task.worktree_path) {
    const project = db.prepare(
      'SELECT path FROM projects WHERE id = ?'
    ).get(task.project_id) as { path: string } | undefined

    if (project?.path) {
      try {
        removeWorktree(project.path, task.worktree_path)
      } catch (err) {
        console.error('Failed to remove worktree:', err)
      }
    }
  }
}

export function registerTaskHandlers(ipcMain: IpcMain, db: Database): void {

  // Task CRUD
  ipcMain.handle('db:tasks:getAll', () => {
    const rows = db
      .prepare('SELECT * FROM tasks WHERE archived_at IS NULL ORDER BY "order" ASC, created_at DESC')
      .all() as Record<string, unknown>[]
    return parseTasks(rows)
  })

  ipcMain.handle('db:tasks:getByProject', (_, projectId: string) => {
    const rows = db
      .prepare(
        'SELECT * FROM tasks WHERE project_id = ? AND archived_at IS NULL ORDER BY "order" ASC, created_at DESC'
      )
      .all(projectId) as Record<string, unknown>[]
    return parseTasks(rows)
  })

  ipcMain.handle('db:tasks:get', (_, id: string) => {
    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Record<string, unknown> | undefined
    return parseTask(row)
  })

  ipcMain.handle('db:tasks:create', (_, data: CreateTaskInput) => {
    const id = crypto.randomUUID()
    const stmt = db.prepare(`
      INSERT INTO tasks (id, project_id, title, description, status, priority, due_date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      id,
      data.projectId,
      data.title,
      data.description ?? null,
      data.status ?? 'inbox',
      data.priority ?? 3,
      data.dueDate ?? null
    )
    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Record<string, unknown> | undefined
    return parseTask(row)
  })

  ipcMain.handle('db:tasks:update', (_, data: UpdateTaskInput) => {
    const fields: string[] = []
    const values: unknown[] = []

    if (data.title !== undefined) {
      fields.push('title = ?')
      values.push(data.title)
    }
    if (data.description !== undefined) {
      fields.push('description = ?')
      values.push(data.description)
    }
    if (data.status !== undefined) {
      fields.push('status = ?')
      values.push(data.status)
    }
    if (data.priority !== undefined) {
      fields.push('priority = ?')
      values.push(data.priority)
    }
    if (data.dueDate !== undefined) {
      fields.push('due_date = ?')
      values.push(data.dueDate)
    }
    if (data.projectId !== undefined) {
      fields.push('project_id = ?')
      values.push(data.projectId)
    }
    if (data.claudeSessionId !== undefined) {
      fields.push('claude_session_id = ?')
      values.push(data.claudeSessionId)
    }
    if (data.terminalMode !== undefined) {
      fields.push('terminal_mode = ?')
      values.push(data.terminalMode)
    }
    if (data.claudeConversationId !== undefined) {
      fields.push('claude_conversation_id = ?')
      values.push(data.claudeConversationId)
    }
    if (data.codexConversationId !== undefined) {
      fields.push('codex_conversation_id = ?')
      values.push(data.codexConversationId)
    }
    if (data.terminalShell !== undefined) {
      fields.push('terminal_shell = ?')
      values.push(data.terminalShell)
    }
    if (data.dangerouslySkipPermissions !== undefined) {
      fields.push('dangerously_skip_permissions = ?')
      values.push(data.dangerouslySkipPermissions ? 1 : 0)
    }
    if (data.panelVisibility !== undefined) {
      fields.push('panel_visibility = ?')
      values.push(data.panelVisibility ? JSON.stringify(data.panelVisibility) : null)
    }
    if (data.worktreePath !== undefined) {
      fields.push('worktree_path = ?')
      values.push(data.worktreePath)
    }
    if (data.worktreeParentBranch !== undefined) {
      fields.push('worktree_parent_branch = ?')
      values.push(data.worktreeParentBranch)
    }
    if (data.browserUrl !== undefined) {
      fields.push('browser_url = ?')
      values.push(data.browserUrl)
    }
    if (data.browserTabs !== undefined) {
      fields.push('browser_tabs = ?')
      values.push(data.browserTabs ? JSON.stringify(data.browserTabs) : null)
    }

    if (fields.length === 0) {
      const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(data.id) as Record<string, unknown> | undefined
      return parseTask(row)
    }

    fields.push("updated_at = datetime('now')")
    values.push(data.id)

    db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values)

    if (data.status === 'done') {
      killPtysByTaskId(data.id)
    }

    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(data.id) as Record<string, unknown> | undefined
    return parseTask(row)
  })

  ipcMain.handle('db:tasks:delete', (_, id: string) => {
    cleanupTask(db, id)
    const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(id)
    return result.changes > 0
  })

  // Archive operations
  ipcMain.handle('db:tasks:archive', (_, id: string) => {
    cleanupTask(db, id)
    db.prepare(`
      UPDATE tasks SET archived_at = datetime('now'), worktree_path = NULL, updated_at = datetime('now')
      WHERE id = ?
    `).run(id)
    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Record<string, unknown> | undefined
    return parseTask(row)
  })

  ipcMain.handle('db:tasks:archiveMany', (_, ids: string[]) => {
    if (ids.length === 0) return
    for (const id of ids) {
      cleanupTask(db, id)
    }
    const placeholders = ids.map(() => '?').join(',')
    db.prepare(`
      UPDATE tasks SET archived_at = datetime('now'), worktree_path = NULL, updated_at = datetime('now')
      WHERE id IN (${placeholders})
    `).run(...ids)
  })

  ipcMain.handle('db:tasks:unarchive', (_, id: string) => {
    db.prepare(`
      UPDATE tasks SET archived_at = NULL, updated_at = datetime('now')
      WHERE id = ?
    `).run(id)
    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Record<string, unknown> | undefined
    return parseTask(row)
  })

  ipcMain.handle('db:tasks:getArchived', () => {
    const rows = db
      .prepare('SELECT * FROM tasks WHERE archived_at IS NOT NULL ORDER BY archived_at DESC')
      .all() as Record<string, unknown>[]
    return parseTasks(rows)
  })

  // Reorder
  ipcMain.handle('db:tasks:reorder', (_, taskIds: string[]) => {
    const stmt = db.prepare('UPDATE tasks SET "order" = ? WHERE id = ?')
    db.transaction(() => {
      taskIds.forEach((id, index) => {
        stmt.run(index, id)
      })
    })()
  })

  // Task Dependencies
  ipcMain.handle('db:taskDependencies:getBlockers', (_, taskId: string) => {
    const rows = db
      .prepare(
        `SELECT tasks.* FROM tasks
         JOIN task_dependencies ON tasks.id = task_dependencies.task_id
         WHERE task_dependencies.blocks_task_id = ?`
      )
      .all(taskId) as Record<string, unknown>[]
    return parseTasks(rows)
  })

  ipcMain.handle('db:taskDependencies:getBlocking', (_, taskId: string) => {
    const rows = db
      .prepare(
        `SELECT tasks.* FROM tasks
         JOIN task_dependencies ON tasks.id = task_dependencies.blocks_task_id
         WHERE task_dependencies.task_id = ?`
      )
      .all(taskId) as Record<string, unknown>[]
    return parseTasks(rows)
  })

  ipcMain.handle(
    'db:taskDependencies:addBlocker',
    (_, taskId: string, blockerTaskId: string) => {
      db.prepare(
        'INSERT OR IGNORE INTO task_dependencies (task_id, blocks_task_id) VALUES (?, ?)'
      ).run(blockerTaskId, taskId)
    }
  )

  ipcMain.handle(
    'db:taskDependencies:removeBlocker',
    (_, taskId: string, blockerTaskId: string) => {
      db.prepare(
        'DELETE FROM task_dependencies WHERE task_id = ? AND blocks_task_id = ?'
      ).run(blockerTaskId, taskId)
    }
  )

  ipcMain.handle(
    'db:taskDependencies:setBlockers',
    (_, taskId: string, blockerTaskIds: string[]) => {
      const deleteStmt = db.prepare('DELETE FROM task_dependencies WHERE blocks_task_id = ?')
      const insertStmt = db.prepare(
        'INSERT INTO task_dependencies (task_id, blocks_task_id) VALUES (?, ?)'
      )

      db.transaction(() => {
        deleteStmt.run(taskId)
        for (const blockerTaskId of blockerTaskIds) {
          insertStmt.run(blockerTaskId, taskId)
        }
      })()
    }
  )
}
