import { ipcMain } from 'electron'
import { getDatabase } from '../db'
import type {
  CreateTaskInput,
  CreateProjectInput,
  UpdateTaskInput,
  UpdateProjectInput,
  CreateTagInput,
  UpdateTagInput,
  CreateChatMessageInput
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
    return db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all()
  })

  ipcMain.handle('db:tasks:getByProject', (_, projectId: string) => {
    return db
      .prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at DESC')
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
    return db.prepare('SELECT * FROM tasks WHERE parent_id = ? ORDER BY created_at').all(parentId)
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
}
