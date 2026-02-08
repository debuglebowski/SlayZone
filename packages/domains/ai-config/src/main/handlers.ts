import type { IpcMain } from 'electron'
import type { Database } from 'better-sqlite3'
import type {
  AiConfigItem,
  AiConfigProjectSelection,
  AiConfigSourcePlaceholder,
  CreateAiConfigItemInput,
  CreateAiConfigSourcePlaceholderInput,
  ListAiConfigItemsInput,
  SetAiConfigProjectSelectionInput,
  UpdateAiConfigItemInput
} from '../shared'

function parseSource(row: Record<string, unknown>): AiConfigSourcePlaceholder {
  return {
    ...row,
    enabled: Boolean(row.enabled)
  } as AiConfigSourcePlaceholder
}

export function registerAiConfigHandlers(ipcMain: IpcMain, db: Database): void {
  ipcMain.handle('ai-config:list-items', (_event, input: ListAiConfigItemsInput) => {
    const where: string[] = ['scope = ?']
    const values: unknown[] = [input.scope]

    if (input.scope === 'project' && input.projectId) {
      where.push('project_id = ?')
      values.push(input.projectId)
    }

    if (input.type) {
      where.push('type = ?')
      values.push(input.type)
    }

    const rows = db.prepare(`
      SELECT * FROM ai_config_items
      WHERE ${where.join(' AND ')}
      ORDER BY updated_at DESC, created_at DESC
    `).all(...values) as AiConfigItem[]

    return rows
  })

  ipcMain.handle('ai-config:get-item', (_event, id: string) => {
    const row = db.prepare('SELECT * FROM ai_config_items WHERE id = ?').get(id) as AiConfigItem | undefined
    return row ?? null
  })

  ipcMain.handle('ai-config:create-item', (_event, input: CreateAiConfigItemInput) => {
    const id = crypto.randomUUID()
    const projectId = input.scope === 'project' ? (input.projectId ?? null) : null
    db.prepare(`
      INSERT INTO ai_config_items (
        id, type, scope, project_id, name, slug, content, metadata_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      id,
      input.type,
      input.scope,
      projectId,
      input.name,
      input.slug,
      input.content ?? '',
      input.metadataJson ?? '{}'
    )

    const row = db.prepare('SELECT * FROM ai_config_items WHERE id = ?').get(id) as AiConfigItem
    return row
  })

  ipcMain.handle('ai-config:update-item', (_event, input: UpdateAiConfigItemInput) => {
    const fields: string[] = []
    const values: unknown[] = []

    if (input.type !== undefined) {
      fields.push('type = ?')
      values.push(input.type)
    }
    if (input.scope !== undefined) {
      fields.push('scope = ?')
      values.push(input.scope)
      if (input.scope === 'global') {
        fields.push('project_id = NULL')
      }
    }
    if (input.projectId !== undefined) {
      fields.push('project_id = ?')
      values.push(input.projectId)
    }
    if (input.name !== undefined) {
      fields.push('name = ?')
      values.push(input.name)
    }
    if (input.slug !== undefined) {
      fields.push('slug = ?')
      values.push(input.slug)
    }
    if (input.content !== undefined) {
      fields.push('content = ?')
      values.push(input.content)
    }
    if (input.metadataJson !== undefined) {
      fields.push('metadata_json = ?')
      values.push(input.metadataJson)
    }

    if (fields.length > 0) {
      fields.push("updated_at = datetime('now')")
      values.push(input.id)
      db.prepare(`UPDATE ai_config_items SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    }

    const row = db.prepare('SELECT * FROM ai_config_items WHERE id = ?').get(input.id) as AiConfigItem | undefined
    return row ?? null
  })

  ipcMain.handle('ai-config:delete-item', (_event, id: string) => {
    const result = db.prepare('DELETE FROM ai_config_items WHERE id = ?').run(id)
    return result.changes > 0
  })

  ipcMain.handle('ai-config:list-project-selections', (_event, projectId: string) => {
    const rows = db.prepare(`
      SELECT * FROM ai_config_project_selections
      WHERE project_id = ?
      ORDER BY selected_at DESC
    `).all(projectId) as AiConfigProjectSelection[]
    return rows
  })

  ipcMain.handle('ai-config:set-project-selection', (_event, input: SetAiConfigProjectSelectionInput) => {
    const id = crypto.randomUUID()
    db.prepare(`
      INSERT INTO ai_config_project_selections (
        id, project_id, item_id, target_path, selected_at
      ) VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(project_id, item_id) DO UPDATE SET
        target_path = excluded.target_path,
        selected_at = datetime('now')
    `).run(id, input.projectId, input.itemId, input.targetPath)
  })

  ipcMain.handle('ai-config:remove-project-selection', (_event, projectId: string, itemId: string) => {
    const result = db.prepare(`
      DELETE FROM ai_config_project_selections
      WHERE project_id = ? AND item_id = ?
    `).run(projectId, itemId)
    return result.changes > 0
  })

  ipcMain.handle('ai-config:list-sources', () => {
    const rows = db.prepare(`
      SELECT * FROM ai_config_sources
      ORDER BY updated_at DESC, created_at DESC
    `).all() as Record<string, unknown>[]
    return rows.map(parseSource)
  })

  ipcMain.handle('ai-config:create-source-placeholder', (_event, input: CreateAiConfigSourcePlaceholderInput) => {
    const id = crypto.randomUUID()
    db.prepare(`
      INSERT INTO ai_config_sources (
        id, name, kind, enabled, status, last_checked_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, NULL, datetime('now'), datetime('now'))
    `).run(
      id,
      input.name,
      input.kind,
      input.enabled ? 1 : 0,
      input.status ?? 'placeholder'
    )
    const row = db.prepare('SELECT * FROM ai_config_sources WHERE id = ?').get(id) as Record<string, unknown>
    return parseSource(row)
  })
}
