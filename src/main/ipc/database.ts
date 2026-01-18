import { ipcMain } from 'electron'
import { getDatabase } from '../db'
import type {
  CreateTaskInput,
  CreateProjectInput,
  UpdateTaskInput,
  UpdateProjectInput,
  CreateTagInput,
  UpdateTagInput,
  CreateChatMessageInput,
  CreateWorkspaceItemInput,
  UpdateWorkspaceItemInput
} from '../../shared/types/api'

export function registerDatabaseHandlers(): void {
  const db = getDatabase()

  // Projects
  ipcMain.handle('db:projects:getAll', () => {
    return db.prepare('SELECT * FROM projects ORDER BY name').all()
  })

  ipcMain.handle('db:projects:create', (_, data: CreateProjectInput) => {
    const id = crypto.randomUUID()
    const stmt = db.prepare(`
      INSERT INTO projects (id, name, color)
      VALUES (?, ?, ?)
    `)
    stmt.run(id, data.name, data.color)
    return db.prepare('SELECT * FROM projects WHERE id = ?').get(id)
  })

  ipcMain.handle('db:projects:update', (_, data: UpdateProjectInput) => {
    const fields: string[] = []
    const values: unknown[] = []

    if (data.name !== undefined) {
      fields.push('name = ?')
      values.push(data.name)
    }
    if (data.color !== undefined) {
      fields.push('color = ?')
      values.push(data.color)
    }

    if (fields.length === 0) {
      return db.prepare('SELECT * FROM projects WHERE id = ?').get(data.id)
    }

    fields.push("updated_at = datetime('now')")
    values.push(data.id)

    db.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    return db.prepare('SELECT * FROM projects WHERE id = ?').get(data.id)
  })

  ipcMain.handle('db:projects:delete', (_, id: string) => {
    const result = db.prepare('DELETE FROM projects WHERE id = ?').run(id)
    return result.changes > 0
  })

  // Tasks
  ipcMain.handle('db:tasks:getAll', () => {
    return db.prepare('SELECT * FROM tasks WHERE archived_at IS NULL ORDER BY created_at DESC').all()
  })

  ipcMain.handle('db:tasks:getByProject', (_, projectId: string) => {
    return db
      .prepare('SELECT * FROM tasks WHERE project_id = ? AND archived_at IS NULL ORDER BY created_at DESC')
      .all(projectId)
  })

  ipcMain.handle('db:tasks:get', (_, id: string) => {
    return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) ?? null
  })

  ipcMain.handle('db:tasks:create', (_, data: CreateTaskInput) => {
    const id = crypto.randomUUID()
    const stmt = db.prepare(`
      INSERT INTO tasks (id, project_id, title, description, status, priority, due_date, parent_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      id,
      data.projectId,
      data.title,
      data.description ?? null,
      data.status ?? 'inbox',
      data.priority ?? 3,
      data.dueDate ?? null,
      data.parentId ?? null
    )
    return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
  })

  ipcMain.handle('db:tasks:getSubtasks', (_, parentId: string) => {
    return db.prepare('SELECT * FROM tasks WHERE parent_id = ? AND archived_at IS NULL ORDER BY created_at').all(parentId)
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
    if (data.blockedReason !== undefined) {
      fields.push('blocked_reason = ?')
      values.push(data.blockedReason)
    }
    if (data.recurrenceType !== undefined) {
      fields.push('recurrence_type = ?')
      values.push(data.recurrenceType)
    }
    if (data.recurrenceInterval !== undefined) {
      fields.push('recurrence_interval = ?')
      values.push(data.recurrenceInterval)
    }
    if (data.nextResetAt !== undefined) {
      fields.push('next_reset_at = ?')
      values.push(data.nextResetAt)
    }
    if (data.projectId !== undefined) {
      fields.push('project_id = ?')
      values.push(data.projectId)
    }
    if (data.lastActiveWorkspaceItemId !== undefined) {
      fields.push('last_active_workspace_item_id = ?')
      values.push(data.lastActiveWorkspaceItemId)
    }

    if (fields.length === 0) {
      return db.prepare('SELECT * FROM tasks WHERE id = ?').get(data.id)
    }

    fields.push("updated_at = datetime('now')")
    values.push(data.id)

    db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    return db.prepare('SELECT * FROM tasks WHERE id = ?').get(data.id)
  })

  ipcMain.handle('db:tasks:delete', (_, id: string) => {
    const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(id)
    return result.changes > 0
  })

  ipcMain.handle('db:tasks:archive', (_, id: string) => {
    const archiveStmt = db.prepare(`
      UPDATE tasks SET archived_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ? OR parent_id = ?
    `)
    db.transaction(() => {
      archiveStmt.run(id, id)
    })()
    return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
  })

  ipcMain.handle('db:tasks:unarchive', (_, id: string) => {
    const unarchiveStmt = db.prepare(`
      UPDATE tasks SET archived_at = NULL, updated_at = datetime('now')
      WHERE id = ? OR parent_id = ?
    `)
    db.transaction(() => {
      unarchiveStmt.run(id, id)
    })()
    return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
  })

  ipcMain.handle('db:tasks:getArchived', () => {
    return db
      .prepare('SELECT * FROM tasks WHERE archived_at IS NOT NULL AND parent_id IS NULL ORDER BY archived_at DESC')
      .all()
  })

  // Tags
  ipcMain.handle('db:tags:getAll', () => {
    return db.prepare('SELECT * FROM tags ORDER BY name').all()
  })

  ipcMain.handle('db:tags:create', (_, data: CreateTagInput) => {
    const id = crypto.randomUUID()
    db.prepare('INSERT INTO tags (id, name, color) VALUES (?, ?, ?)').run(
      id,
      data.name,
      data.color ?? '#6b7280'
    )
    return db.prepare('SELECT * FROM tags WHERE id = ?').get(id)
  })

  ipcMain.handle('db:tags:update', (_, data: UpdateTagInput) => {
    const fields: string[] = []
    const values: unknown[] = []

    if (data.name !== undefined) {
      fields.push('name = ?')
      values.push(data.name)
    }
    if (data.color !== undefined) {
      fields.push('color = ?')
      values.push(data.color)
    }

    if (fields.length > 0) {
      values.push(data.id)
      db.prepare(`UPDATE tags SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    }

    return db.prepare('SELECT * FROM tags WHERE id = ?').get(data.id)
  })

  ipcMain.handle('db:tags:delete', (_, id: string) => {
    const result = db.prepare('DELETE FROM tags WHERE id = ?').run(id)
    return result.changes > 0
  })

  // Settings
  ipcMain.handle('db:settings:get', (_, key: string) => {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      | { value: string }
      | undefined
    return row?.value ?? null
  })

  ipcMain.handle('db:settings:set', (_, key: string, value: string) => {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value)
  })

  ipcMain.handle('db:settings:getAll', () => {
    const rows = db.prepare('SELECT key, value FROM settings').all() as {
      key: string
      value: string
    }[]
    return Object.fromEntries(rows.map((r) => [r.key, r.value]))
  })

  // Task Tags
  ipcMain.handle('db:taskTags:getForTask', (_, taskId: string) => {
    return db
      .prepare(
        `SELECT tags.* FROM tags
         JOIN task_tags ON tags.id = task_tags.tag_id
         WHERE task_tags.task_id = ?`
      )
      .all(taskId)
  })

  ipcMain.handle('db:taskTags:setForTask', (_, taskId: string, tagIds: string[]) => {
    const deleteStmt = db.prepare('DELETE FROM task_tags WHERE task_id = ?')
    const insertStmt = db.prepare('INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)')

    db.transaction(() => {
      deleteStmt.run(taskId)
      for (const tagId of tagIds) {
        insertStmt.run(taskId, tagId)
      }
    })()
  })

  // Chat Messages
  ipcMain.handle('db:chatMessages:getByWorkspace', (_, workspaceItemId: string) => {
    return db
      .prepare('SELECT * FROM chat_messages WHERE workspace_item_id = ? ORDER BY created_at')
      .all(workspaceItemId)
  })

  ipcMain.handle('db:chatMessages:create', (_, data: CreateChatMessageInput) => {
    const id = crypto.randomUUID()
    db.prepare(`
      INSERT INTO chat_messages (id, workspace_item_id, role, content)
      VALUES (?, ?, ?, ?)
    `).run(id, data.workspaceItemId, data.role, data.content)
    return db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(id)
  })

  ipcMain.handle('db:chatMessages:delete', (_, id: string) => {
    const result = db.prepare('DELETE FROM chat_messages WHERE id = ?').run(id)
    return result.changes > 0
  })

  // Workspace Items
  ipcMain.handle('db:workspaceItems:getByTask', (_, taskId: string) => {
    return db.prepare('SELECT * FROM workspace_items WHERE task_id = ? ORDER BY created_at').all(taskId)
  })

  ipcMain.handle('db:workspaceItems:create', (_, data: CreateWorkspaceItemInput) => {
    const id = crypto.randomUUID()
    db.prepare(`
      INSERT INTO workspace_items (id, task_id, type, name, content, url)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, data.taskId, data.type, data.name, data.content ?? null, data.url ?? null)
    return db.prepare('SELECT * FROM workspace_items WHERE id = ?').get(id)
  })

  ipcMain.handle('db:workspaceItems:update', (_, data: UpdateWorkspaceItemInput) => {
    const fields: string[] = []
    const values: unknown[] = []

    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name) }
    if (data.content !== undefined) { fields.push('content = ?'); values.push(data.content) }
    if (data.url !== undefined) { fields.push('url = ?'); values.push(data.url) }
    if (data.favicon !== undefined) { fields.push('favicon = ?'); values.push(data.favicon) }

    if (fields.length > 0) {
      fields.push("updated_at = datetime('now')")
      values.push(data.id)
      db.prepare(`UPDATE workspace_items SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    }
    return db.prepare('SELECT * FROM workspace_items WHERE id = ?').get(data.id)
  })

  ipcMain.handle('db:workspaceItems:delete', (_, id: string) => {
    const result = db.prepare('DELETE FROM workspace_items WHERE id = ?').run(id)
    return result.changes > 0
  })

  // Recurring Tasks
  ipcMain.handle('db:tasks:checkAndResetRecurring', () => {
    const now = new Date().toISOString()
    const tasksToReset = db
      .prepare(
        `SELECT * FROM tasks 
         WHERE next_reset_at IS NOT NULL 
         AND next_reset_at <= ? 
         AND recurrence_type IS NOT NULL
         AND archived_at IS NULL`
      )
      .all(now) as Array<{
      id: string
      recurrence_type: string
      recurrence_interval: number
      next_reset_at: string
    }>

    const updateStmt = db.prepare(`
      UPDATE tasks 
      SET status = 'inbox',
          last_reset_at = datetime('now'),
          next_reset_at = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `)

    db.transaction(() => {
      for (const task of tasksToReset) {
        const lastReset = new Date(task.next_reset_at)
        let nextReset: Date

        if (task.recurrence_type === 'daily') {
          nextReset = new Date(lastReset)
          nextReset.setDate(nextReset.getDate() + task.recurrence_interval)
        } else if (task.recurrence_type === 'weekly') {
          nextReset = new Date(lastReset)
          nextReset.setDate(nextReset.getDate() + task.recurrence_interval * 7)
        } else if (task.recurrence_type === 'monthly') {
          nextReset = new Date(lastReset)
          nextReset.setMonth(nextReset.getMonth() + task.recurrence_interval)
        } else {
          continue
        }

        updateStmt.run(nextReset.toISOString(), task.id)
      }
    })()

    return tasksToReset.length
  })
}
