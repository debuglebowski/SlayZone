import type { IpcMain } from 'electron'
import type { Database } from 'better-sqlite3'
import type { CreateTaskInput, UpdateTaskInput, Task } from '@slayzone/task/shared'
import { recordDiagnosticEvent } from '@slayzone/diagnostics/main'
import path from 'path'
import { removeWorktree, createWorktree, getCurrentBranch, isGitRepo } from '@slayzone/worktrees/main'
import { killPtysByTaskId } from '@slayzone/terminal/main'

// Parse JSON columns from DB row
function parseTask(row: Record<string, unknown> | undefined): Task | null {
  if (!row) return null
  return {
    ...row,
    dangerously_skip_permissions: Boolean(row.dangerously_skip_permissions),
    claude_flags: typeof row.claude_flags === 'string' ? row.claude_flags : '',
    codex_flags: typeof row.codex_flags === 'string' ? row.codex_flags : '',
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
        recordDiagnosticEvent({
          level: 'error',
          source: 'task',
          event: 'task.cleanup_worktree_failed',
          taskId,
          projectId: task.project_id,
          message: err instanceof Error ? err.message : String(err)
        })
      }
    }
  }
}

const DEFAULT_WORKTREE_BASE_PATH_TEMPLATE = '{project}/..'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function parseBooleanSetting(value: string | null | undefined): boolean {
  if (!value) return false
  return value === '1' || value.toLowerCase() === 'true'
}

function resolveWorktreeBasePathTemplate(template: string, projectPath: string): string {
  const expanded = template.replaceAll('{project}', projectPath.replace(/[\\/]+$/, ''))
  return path.normalize(expanded)
}

function isAutoCreateWorktreeEnabled(db: Database, projectId: string): boolean {
  const projectRow = db.prepare(
    'SELECT auto_create_worktree_on_task_create FROM projects WHERE id = ?'
  ).get(projectId) as { auto_create_worktree_on_task_create: number | null } | undefined

  if (projectRow?.auto_create_worktree_on_task_create === 1) return true
  if (projectRow?.auto_create_worktree_on_task_create === 0) return false

  const globalRow = db.prepare(
    "SELECT value FROM settings WHERE key = 'auto_create_worktree_on_task_create'"
  ).get() as { value: string } | undefined
  return parseBooleanSetting(globalRow?.value)
}

function maybeAutoCreateWorktree(
  db: Database,
  taskId: string,
  projectId: string,
  taskTitle: string
): void {
  if (!isAutoCreateWorktreeEnabled(db, projectId)) return

  const projectRow = db.prepare('SELECT path FROM projects WHERE id = ?').get(projectId) as
    | { path: string | null }
    | undefined
  if (!projectRow?.path) {
    recordDiagnosticEvent({
      level: 'info',
      source: 'task',
      event: 'task.auto_worktree_skipped',
      taskId,
      projectId,
      message: 'Project path is not set'
    })
    return
  }

  if (!isGitRepo(projectRow.path)) {
    recordDiagnosticEvent({
      level: 'info',
      source: 'task',
      event: 'task.auto_worktree_skipped',
      taskId,
      projectId,
      message: 'Project path is not a git repository',
      payload: { projectPath: projectRow.path }
    })
    return
  }

  const baseTemplate =
    (db.prepare("SELECT value FROM settings WHERE key = 'worktree_base_path'")
      .get() as { value: string } | undefined)?.value || DEFAULT_WORKTREE_BASE_PATH_TEMPLATE
  const basePath = resolveWorktreeBasePathTemplate(baseTemplate, projectRow.path)
  const branch = slugify(taskTitle) || `task-${taskId.slice(0, 8)}`
  const worktreePath = path.join(basePath, branch)
  const parentBranch = getCurrentBranch(projectRow.path)

  try {
    createWorktree(projectRow.path, worktreePath, branch)
    db.prepare(`
      UPDATE tasks
      SET worktree_path = ?, worktree_parent_branch = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(worktreePath, parentBranch, taskId)
    recordDiagnosticEvent({
      level: 'info',
      source: 'task',
      event: 'task.auto_worktree_created',
      taskId,
      projectId,
      payload: {
        projectPath: projectRow.path,
        worktreePath,
        branch,
        parentBranch
      }
    })
  } catch (err) {
    recordDiagnosticEvent({
      level: 'error',
      source: 'task',
      event: 'task.auto_worktree_create_failed',
      taskId,
      projectId,
      message: err instanceof Error ? err.message : String(err),
      payload: {
        projectPath: projectRow.path,
        baseTemplate,
        basePath,
        branch,
        worktreePath
      }
    })
  }
}

export function registerTaskHandlers(ipcMain: IpcMain, db: Database): void {

  // Task CRUD
  ipcMain.handle('db:tasks:getAll', () => {
    const rows = db
      .prepare(`SELECT t.*, el.external_url AS linear_url
        FROM tasks t
        LEFT JOIN external_links el ON el.task_id = t.id AND el.provider = 'linear'
        ORDER BY t."order" ASC, t.created_at DESC`)
      .all() as Record<string, unknown>[]
    return parseTasks(rows)
  })

  ipcMain.handle('db:tasks:getByProject', (_, projectId: string) => {
    const rows = db
      .prepare(
        `SELECT t.*, el.external_url AS linear_url
        FROM tasks t
        LEFT JOIN external_links el ON el.task_id = t.id AND el.provider = 'linear'
        WHERE t.project_id = ? AND t.archived_at IS NULL
        ORDER BY t."order" ASC, t.created_at DESC`
      )
      .all(projectId) as Record<string, unknown>[]
    return parseTasks(rows)
  })

  ipcMain.handle('db:tasks:get', (_, id: string) => {
    const row = db.prepare(
      `SELECT t.*, el.external_url AS linear_url
      FROM tasks t
      LEFT JOIN external_links el ON el.task_id = t.id AND el.provider = 'linear'
      WHERE t.id = ?`
    ).get(id) as Record<string, unknown> | undefined
    return parseTask(row)
  })

  ipcMain.handle('db:tasks:create', (_, data: CreateTaskInput) => {
    const id = crypto.randomUUID()
    const terminalMode = data.terminalMode
      ?? (db.prepare("SELECT value FROM settings WHERE key = 'default_terminal_mode'")
          .get() as { value: string } | undefined)?.value
      ?? 'claude-code'
    const defaultClaudeFlags =
      (db.prepare("SELECT value FROM settings WHERE key = 'default_claude_flags'")
        .get() as { value: string } | undefined)?.value ?? '--allow-dangerously-skip-permissions'
    const defaultCodexFlags =
      (db.prepare("SELECT value FROM settings WHERE key = 'default_codex_flags'")
        .get() as { value: string } | undefined)?.value ?? '--full-auto --search'
    const claudeFlags = data.claudeFlags ?? defaultClaudeFlags
    const codexFlags = data.codexFlags ?? defaultCodexFlags
    const stmt = db.prepare(`
      INSERT INTO tasks (
        id,
        project_id,
        title,
        description,
        assignee,
        status,
        priority,
        due_date,
        terminal_mode,
        claude_flags,
        codex_flags
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      id,
      data.projectId,
      data.title,
      data.description ?? null,
      data.assignee ?? null,
      data.status ?? 'inbox',
      data.priority ?? 3,
      data.dueDate ?? null,
      terminalMode,
      claudeFlags,
      codexFlags
    )
    maybeAutoCreateWorktree(db, id, data.projectId, data.title)
    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Record<string, unknown> | undefined
    return parseTask(row)
  })

  ipcMain.handle('db:tasks:update', (_, data: UpdateTaskInput) => {
    const existing = db.prepare('SELECT project_id FROM tasks WHERE id = ?').get(data.id) as
      | { project_id: string }
      | undefined
    const projectChanged = data.projectId !== undefined && existing?.project_id !== data.projectId

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
    if (data.assignee !== undefined) {
      fields.push('assignee = ?')
      values.push(data.assignee)
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
    if (data.claudeFlags !== undefined) {
      fields.push('claude_flags = ?')
      values.push(data.claudeFlags)
    }
    if (data.codexFlags !== undefined) {
      fields.push('codex_flags = ?')
      values.push(data.codexFlags)
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
    if (data.mergeState !== undefined) {
      fields.push('merge_state = ?')
      values.push(data.mergeState)
    }

    if (fields.length === 0) {
      const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(data.id) as Record<string, unknown> | undefined
      return parseTask(row)
    }

    fields.push("updated_at = datetime('now')")
    values.push(data.id)

    db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values)

    if (data.status === 'done' || projectChanged) {
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
