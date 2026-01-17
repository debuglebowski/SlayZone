import { ipcMain } from 'electron'
import { getDatabase } from '../db'
import type { CreateTaskInput, CreateProjectInput } from '../../shared/types/api'

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

  // Tasks
  ipcMain.handle('db:tasks:getAll', () => {
    return db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all()
  })

  ipcMain.handle('db:tasks:getByProject', (_, projectId: string) => {
    return db
      .prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at DESC')
      .all(projectId)
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
}
