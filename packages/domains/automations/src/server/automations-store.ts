import { randomUUID } from 'node:crypto'
import type { Database } from 'better-sqlite3'
import type { Automation, AutomationRow, AutomationRun, CreateAutomationInput, UpdateAutomationInput } from '../shared'
import { parseAutomationRow } from '../shared'

function safeParse(s: string): unknown {
  try { return JSON.parse(s) } catch { return null }
}

export function listAutomationsByProject(db: Database, projectId: string): Automation[] {
  const rows = db
    .prepare('SELECT * FROM automations WHERE project_id = ? ORDER BY sort_order, created_at')
    .all(projectId) as AutomationRow[]
  return rows.map(parseAutomationRow)
}

export function getAutomation(db: Database, id: string): Automation | null {
  const row = db.prepare('SELECT * FROM automations WHERE id = ?').get(id) as AutomationRow | undefined
  return row ? parseAutomationRow(row) : null
}

export function createAutomation(db: Database, data: CreateAutomationInput): Automation {
  const id = randomUUID()
  const maxOrder = db
    .prepare('SELECT COALESCE(MAX(sort_order), -1) as m FROM automations WHERE project_id = ?')
    .get(data.project_id) as { m: number }
  db.prepare(
    `INSERT INTO automations (id, project_id, name, description, trigger_config, conditions, actions, sort_order, catchup_on_start)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    data.project_id,
    data.name,
    data.description ?? null,
    JSON.stringify(data.trigger_config),
    JSON.stringify(data.conditions ?? []),
    JSON.stringify(data.actions),
    maxOrder.m + 1,
    data.catchup_on_start === false ? 0 : 1,
  )
  const row = db.prepare('SELECT * FROM automations WHERE id = ?').get(id) as AutomationRow
  return parseAutomationRow(row)
}

export function updateAutomation(db: Database, data: UpdateAutomationInput): Automation {
  const fields: string[] = []
  const values: unknown[] = []

  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name) }
  if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description) }
  if (data.enabled !== undefined) { fields.push('enabled = ?'); values.push(data.enabled ? 1 : 0) }
  if (data.trigger_config !== undefined) { fields.push('trigger_config = ?'); values.push(JSON.stringify(data.trigger_config)) }
  if (data.conditions !== undefined) { fields.push('conditions = ?'); values.push(JSON.stringify(data.conditions)) }
  if (data.actions !== undefined) { fields.push('actions = ?'); values.push(JSON.stringify(data.actions)) }
  if (data.sort_order !== undefined) { fields.push('sort_order = ?'); values.push(data.sort_order) }
  if (data.catchup_on_start !== undefined) { fields.push('catchup_on_start = ?'); values.push(data.catchup_on_start ? 1 : 0) }

  if (fields.length > 0) {
    fields.push("updated_at = datetime('now')")
    values.push(data.id)
    db.prepare(`UPDATE automations SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  }

  const row = db.prepare('SELECT * FROM automations WHERE id = ?').get(data.id) as AutomationRow
  return parseAutomationRow(row)
}

export function deleteAutomation(db: Database, id: string): boolean {
  const result = db.prepare('DELETE FROM automations WHERE id = ?').run(id)
  return result.changes > 0
}

export function toggleAutomation(db: Database, id: string, enabled: boolean): Automation {
  db.prepare("UPDATE automations SET enabled = ?, updated_at = datetime('now') WHERE id = ?").run(enabled ? 1 : 0, id)
  const row = db.prepare('SELECT * FROM automations WHERE id = ?').get(id) as AutomationRow
  return parseAutomationRow(row)
}

export function reorderAutomations(db: Database, ids: string[]): void {
  const stmt = db.prepare('UPDATE automations SET sort_order = ? WHERE id = ?')
  db.transaction(() => {
    for (let i = 0; i < ids.length; i++) stmt.run(i, ids[i])
  })()
}

export type AutomationRunRow = Record<string, unknown> & { trigger_event: string | null }

export function listAutomationRuns(db: Database, automationId: string, limit?: number): AutomationRun[] {
  const rows = db
    .prepare('SELECT * FROM automation_runs WHERE automation_id = ? ORDER BY started_at DESC LIMIT ?')
    .all(automationId, limit ?? 50) as AutomationRunRow[]
  return rows.map((row) => ({
    ...row,
    trigger_event: row.trigger_event ? safeParse(row.trigger_event) : null,
  })) as unknown as AutomationRun[]
}

export function clearAutomationRuns(db: Database, automationId: string): void {
  db.prepare('DELETE FROM automation_runs WHERE automation_id = ?').run(automationId)
}
