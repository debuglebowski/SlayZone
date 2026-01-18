import { ipcMain } from 'electron'
import { getDatabase } from '../db'
import type {
  CreateTaskInput,
  CreateProjectInput,
  UpdateTaskInput,
  UpdateProjectInput,
  CreateTagInput,
  UpdateTagInput
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
      INSERT INTO projects (id, name, color, path)
      VALUES (?, ?, ?, ?)
    `)
    stmt.run(id, data.name, data.color, data.path ?? null)
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
    if (data.path !== undefined) {
      fields.push('path = ?')
      values.push(data.path)
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
    return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
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
    db.prepare(`
      UPDATE tasks SET archived_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `).run(id)
    return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
  })

  ipcMain.handle('db:tasks:unarchive', (_, id: string) => {
    db.prepare(`
      UPDATE tasks SET archived_at = NULL, updated_at = datetime('now')
      WHERE id = ?
    `).run(id)
    return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
  })

  ipcMain.handle('db:tasks:getArchived', () => {
    return db
      .prepare('SELECT * FROM tasks WHERE archived_at IS NOT NULL ORDER BY archived_at DESC')
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

  // Task Dependencies
  ipcMain.handle('db:taskDependencies:getBlockers', (_, taskId: string) => {
    return db
      .prepare(
        `SELECT tasks.* FROM tasks
         JOIN task_dependencies ON tasks.id = task_dependencies.task_id
         WHERE task_dependencies.blocks_task_id = ?`
      )
      .all(taskId)
  })

  ipcMain.handle('db:taskDependencies:getBlocking', (_, taskId: string) => {
    return db
      .prepare(
        `SELECT tasks.* FROM tasks
         JOIN task_dependencies ON tasks.id = task_dependencies.blocks_task_id
         WHERE task_dependencies.task_id = ?`
      )
      .all(taskId)
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
