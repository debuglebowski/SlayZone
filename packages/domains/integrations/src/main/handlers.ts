import type { Database } from 'better-sqlite3'
import type { IpcMain } from 'electron'
import { listIssues, listProjects, listTeams, listWorkflowStates, getViewer } from './linear-client'
import { deleteCredential, readCredential, storeCredential } from './credentials'
import type {
  ConnectLinearInput,
  ExternalLink,
  ImportLinearIssuesInput,
  ImportLinearIssuesResult,
  IntegrationConnection,
  IntegrationConnectionPublic,
  IntegrationProjectMapping,
  ListLinearIssuesInput,
  LinearIssueSummary,
  SetProjectMappingInput,
  SyncNowInput
} from '../shared'
import { runSyncNow } from './sync'
import { markdownToHtml } from './markdown'
import {
  getDefaultStatus,
  getDoneStatus,
  getStatusByCategories,
  parseColumnsConfig,
  resolveColumns,
  type ColumnConfig,
  type WorkflowCategory
} from '@slayzone/workflow'

function columnExists(db: Database, table: string, column: string): boolean {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  return columns.some((c) => c.name === column)
}

function ensureIntegrationSchema(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS integration_connections (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      workspace_name TEXT NOT NULL,
      account_label TEXT NOT NULL,
      credential_ref TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_synced_at TEXT DEFAULT NULL,
      UNIQUE(provider, workspace_id)
    );
    CREATE INDEX IF NOT EXISTS idx_integration_connections_provider
      ON integration_connections(provider, updated_at);
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS integration_project_mappings (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      connection_id TEXT NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
      external_team_id TEXT NOT NULL,
      external_team_key TEXT NOT NULL,
      external_project_id TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(project_id, provider)
    );
    CREATE INDEX IF NOT EXISTS idx_integration_project_mappings_connection
      ON integration_project_mappings(connection_id);
  `)

  if (!columnExists(db, 'integration_project_mappings', 'sync_mode')) {
    db.exec(`ALTER TABLE integration_project_mappings ADD COLUMN sync_mode TEXT NOT NULL DEFAULT 'one_way';`)
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS external_links (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      connection_id TEXT NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
      external_type TEXT NOT NULL,
      external_id TEXT NOT NULL,
      external_key TEXT NOT NULL,
      external_url TEXT NOT NULL DEFAULT '',
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      sync_state TEXT NOT NULL DEFAULT 'active',
      last_sync_at TEXT DEFAULT NULL,
      last_error TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(provider, connection_id, external_id),
      UNIQUE(provider, task_id)
    );
    CREATE INDEX IF NOT EXISTS idx_external_links_connection_state
      ON external_links(connection_id, sync_state, updated_at);
    CREATE INDEX IF NOT EXISTS idx_external_links_task
      ON external_links(task_id);

    CREATE TABLE IF NOT EXISTS external_field_state (
      id TEXT PRIMARY KEY,
      external_link_id TEXT NOT NULL REFERENCES external_links(id) ON DELETE CASCADE,
      field_name TEXT NOT NULL,
      last_local_value_json TEXT NOT NULL DEFAULT 'null',
      last_external_value_json TEXT NOT NULL DEFAULT 'null',
      last_local_updated_at TEXT NOT NULL,
      last_external_updated_at TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(external_link_id, field_name)
    );
    CREATE INDEX IF NOT EXISTS idx_external_field_state_link
      ON external_field_state(external_link_id);

    CREATE TABLE IF NOT EXISTS integration_state_mappings (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      project_mapping_id TEXT NOT NULL REFERENCES integration_project_mappings(id) ON DELETE CASCADE,
      local_status TEXT NOT NULL,
      state_id TEXT NOT NULL,
      state_type TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(provider, project_mapping_id, local_status)
    );
  `)
}

function toPublicConnection(conn: IntegrationConnection): IntegrationConnectionPublic {
  return {
    id: conn.id,
    provider: conn.provider,
    workspace_id: conn.workspace_id,
    workspace_name: conn.workspace_name,
    account_label: conn.account_label,
    enabled: Boolean(conn.enabled),
    created_at: conn.created_at,
    updated_at: conn.updated_at,
    last_synced_at: conn.last_synced_at
  }
}

function priorityToLocal(priority: number): number {
  if (priority <= 1) return 5
  if (priority === 2) return 4
  if (priority === 3) return 3
  if (priority === 4) return 2
  if (priority >= 5) return 1
  return 3
}

function getProjectColumns(db: Database, projectId: string): ColumnConfig[] | null {
  const row = db.prepare('SELECT columns_config FROM projects WHERE id = ?').get(projectId) as
    | { columns_config: string | null }
    | undefined
  return parseColumnsConfig(row?.columns_config)
}

function stateToLocal(type: string, columns: ColumnConfig[] | null): string {
  switch (type) {
    case 'backlog':
      return getStatusByCategories(['backlog', 'unstarted', 'triage'], columns) ?? getDefaultStatus(columns)
    case 'started':
      return getStatusByCategories(['started'], columns) ?? getDefaultStatus(columns)
    case 'completed':
      return getStatusByCategories(['completed'], columns) ?? getDoneStatus(columns)
    case 'canceled':
      return getStatusByCategories(['canceled', 'completed'], columns) ?? getDoneStatus(columns)
    case 'unstarted':
      return getStatusByCategories(['unstarted', 'triage', 'backlog'], columns) ?? getDefaultStatus(columns)
    case 'triage':
      return getStatusByCategories(['triage', 'unstarted', 'backlog'], columns) ?? getDefaultStatus(columns)
    default:
      return getDefaultStatus(columns)
  }
}

function upsertLinkForIssue(
  db: Database,
  issue: LinearIssueSummary,
  connectionId: string,
  taskId: string
): ExternalLink {
  const existing = db.prepare(
    `SELECT * FROM external_links WHERE provider = 'linear' AND connection_id = ? AND external_id = ?`
  ).get(connectionId, issue.id) as ExternalLink | undefined

  if (existing) {
    db.prepare(`
      UPDATE external_links
      SET task_id = ?, external_key = ?, external_url = ?, sync_state = 'active',
          last_error = NULL, updated_at = datetime('now')
      WHERE id = ?
    `).run(taskId, issue.identifier, issue.url, existing.id)
    return db.prepare('SELECT * FROM external_links WHERE id = ?').get(existing.id) as ExternalLink
  }

  const id = crypto.randomUUID()
  db.prepare(`
    INSERT INTO external_links (
      id, provider, connection_id, external_type, external_id, external_key,
      external_url, task_id, sync_state, last_sync_at, last_error, created_at, updated_at
    ) VALUES (?, 'linear', ?, 'issue', ?, ?, ?, ?, 'active', datetime('now'), NULL, datetime('now'), datetime('now'))
  `).run(id, connectionId, issue.id, issue.identifier, issue.url, taskId)

  return db.prepare('SELECT * FROM external_links WHERE id = ?').get(id) as ExternalLink
}

function upsertTaskFromIssue(db: Database, localProjectId: string, issue: LinearIssueSummary): string {
  const projectColumns = getProjectColumns(db, localProjectId)
  const byLink = db.prepare(`
    SELECT task_id FROM external_links
    WHERE provider = 'linear' AND external_id = ?
  `).get(issue.id) as { task_id: string } | undefined

  const descHtml = issue.description ? markdownToHtml(issue.description) : null

  if (byLink) {
    db.prepare(`
      UPDATE tasks
      SET project_id = ?, title = ?, description = ?, status = ?, priority = ?, assignee = ?, updated_at = ?
      WHERE id = ?
    `).run(
      localProjectId,
      issue.title,
      descHtml,
      stateToLocal(issue.state.type, projectColumns),
      priorityToLocal(issue.priority),
      issue.assignee?.name ?? null,
      issue.updatedAt,
      byLink.task_id
    )
    return byLink.task_id
  }

  const id = crypto.randomUUID()
  db.prepare(`
    INSERT INTO tasks (
      id, project_id, title, description, status, priority, assignee,
      terminal_mode, provider_config, claude_flags, codex_flags, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'claude-code',
      '{"ccs":{"flags":"--allow-dangerously-skip-permissions"},"claude-code":{"flags":"--allow-dangerously-skip-permissions"},"codex":{"flags":"--full-auto --search"},"cursor-agent":{"flags":"--force"},"gemini":{"flags":"--yolo"},"opencode":{"flags":""}}',
      '--allow-dangerously-skip-permissions', '--full-auto --search', datetime('now'), ?)
  `).run(
    id,
    localProjectId,
    issue.title,
    descHtml,
    stateToLocal(issue.state.type, projectColumns),
    priorityToLocal(issue.priority),
    issue.assignee?.name ?? null,
    issue.updatedAt
  )

  return id
}

function getConnection(db: Database, id: string): IntegrationConnection {
  const row = db.prepare('SELECT * FROM integration_connections WHERE id = ?').get(id) as IntegrationConnection | undefined
  if (!row) throw new Error('Integration connection not found')
  return row
}

function getLinearStateTypeForCategory(
  category: WorkflowCategory,
  availableStateTypes: Set<string>
): string | null {
  const candidates: Record<WorkflowCategory, string[]> = {
    triage: ['triage', 'unstarted', 'backlog'],
    backlog: ['backlog', 'unstarted', 'triage'],
    unstarted: ['unstarted', 'triage', 'backlog'],
    started: ['started'],
    completed: ['completed', 'canceled'],
    canceled: ['canceled', 'completed']
  }
  return candidates[category].find((type) => availableStateTypes.has(type)) ?? null
}

function refreshStateMappings(
  db: Database,
  projectMappingId: string,
  projectId: string,
  states: Array<{ id: string; type: string }>
): void {
  const stateIdByType = new Map<string, string>()
  for (const state of states) {
    if (!stateIdByType.has(state.type)) {
      stateIdByType.set(state.type, state.id)
    }
  }

  const columns = resolveColumns(getProjectColumns(db, projectId))
  const availableStateTypes = new Set(stateIdByType.keys())
  db.prepare("DELETE FROM integration_state_mappings WHERE provider = 'linear' AND project_mapping_id = ?")
    .run(projectMappingId)

  for (const column of columns) {
    const stateType = getLinearStateTypeForCategory(column.category, availableStateTypes)
    if (!stateType) continue
    const stateId = stateIdByType.get(stateType)
    if (!stateId) continue

    db.prepare(`
      INSERT INTO integration_state_mappings (
        id, provider, project_mapping_id, local_status, state_id, state_type, created_at, updated_at
      ) VALUES (?, 'linear', ?, ?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(provider, project_mapping_id, local_status) DO UPDATE SET
        state_id = excluded.state_id,
        state_type = excluded.state_type,
        updated_at = datetime('now')
    `).run(crypto.randomUUID(), projectMappingId, column.id, stateId, stateType)
  }
}

export function registerIntegrationHandlers(ipcMain: IpcMain, db: Database): void {
  ensureIntegrationSchema(db)

  ipcMain.handle('integrations:connect-linear', async (_event, input: ConnectLinearInput) => {
    const apiKey = input.apiKey.trim()
    if (!apiKey) throw new Error('API key required')

    const viewer = await getViewer(apiKey)

    const credentialRef = crypto.randomUUID()
    storeCredential(db, credentialRef, apiKey)

    const existing = db.prepare(`
      SELECT * FROM integration_connections
      WHERE provider = 'linear' AND workspace_id = ?
    `).get(viewer.workspaceId) as IntegrationConnection | undefined

    if (existing) {
      deleteCredential(db, existing.credential_ref)
      db.prepare(`
        UPDATE integration_connections
        SET workspace_name = ?, account_label = ?, credential_ref = ?, enabled = 1, updated_at = datetime('now')
        WHERE id = ?
      `).run(
        viewer.workspaceName,
        input.accountLabel?.trim() || viewer.accountLabel,
        credentialRef,
        existing.id
      )
      const row = getConnection(db, existing.id)
      return toPublicConnection(row)
    }

    const id = crypto.randomUUID()
    db.prepare(`
      INSERT INTO integration_connections (
        id, provider, workspace_id, workspace_name, account_label, credential_ref,
        enabled, created_at, updated_at, last_synced_at
      ) VALUES (?, 'linear', ?, ?, ?, ?, 1, datetime('now'), datetime('now'), NULL)
    `).run(
      id,
      viewer.workspaceId,
      viewer.workspaceName,
      input.accountLabel?.trim() || viewer.accountLabel,
      credentialRef
    )

    const row = getConnection(db, id)
    return toPublicConnection(row)
  })

  ipcMain.handle('integrations:list-connections', (_event, provider?: 'linear') => {
    const rows = provider
      ? db.prepare('SELECT * FROM integration_connections WHERE provider = ? ORDER BY updated_at DESC').all(provider)
      : db.prepare('SELECT * FROM integration_connections ORDER BY updated_at DESC').all()
    return (rows as IntegrationConnection[]).map(toPublicConnection)
  })

  ipcMain.handle('integrations:disconnect', (_event, connectionId: string) => {
    const connection = getConnection(db, connectionId)
    deleteCredential(db, connection.credential_ref)

    db.transaction(() => {
      db.prepare('DELETE FROM integration_state_mappings WHERE project_mapping_id IN (SELECT id FROM integration_project_mappings WHERE connection_id = ?)').run(connectionId)
      db.prepare('DELETE FROM integration_project_mappings WHERE connection_id = ?').run(connectionId)
      db.prepare('DELETE FROM external_field_state WHERE external_link_id IN (SELECT id FROM external_links WHERE connection_id = ?)').run(connectionId)
      db.prepare('DELETE FROM external_links WHERE connection_id = ?').run(connectionId)
      db.prepare('DELETE FROM integration_connections WHERE id = ?').run(connectionId)
    })()

    return true
  })

  ipcMain.handle('integrations:list-linear-teams', async (_event, connectionId: string) => {
    const connection = getConnection(db, connectionId)
    const apiKey = readCredential(db, connection.credential_ref)
    return listTeams(apiKey)
  })

  ipcMain.handle('integrations:list-linear-projects', async (_event, connectionId: string, teamId: string) => {
    const connection = getConnection(db, connectionId)
    const apiKey = readCredential(db, connection.credential_ref)
    return listProjects(apiKey, teamId)
  })

  ipcMain.handle('integrations:set-project-mapping', async (_event, input: SetProjectMappingInput) => {
    const connection = getConnection(db, input.connectionId)

    const existing = db.prepare(`
      SELECT * FROM integration_project_mappings
      WHERE provider = ? AND project_id = ?
    `).get(input.provider, input.projectId) as IntegrationProjectMapping | undefined

    const mappingId = existing?.id ?? crypto.randomUUID()
    db.prepare(`
      INSERT INTO integration_project_mappings (
        id, project_id, provider, connection_id, external_team_id, external_team_key, external_project_id, sync_mode, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(project_id, provider) DO UPDATE SET
        connection_id = excluded.connection_id,
        external_team_id = excluded.external_team_id,
        external_team_key = excluded.external_team_key,
        external_project_id = excluded.external_project_id,
        sync_mode = excluded.sync_mode,
        updated_at = datetime('now')
    `).run(
      mappingId,
      input.projectId,
      input.provider,
      input.connectionId,
      input.externalTeamId,
      input.externalTeamKey,
      input.externalProjectId ?? null,
      input.syncMode ?? 'one_way'
    )

    if (input.provider === 'linear') {
      const apiKey = readCredential(db, connection.credential_ref)
      const states = await listWorkflowStates(apiKey, input.externalTeamId)
      refreshStateMappings(db, mappingId, input.projectId, states)
    }

    return db.prepare('SELECT * FROM integration_project_mappings WHERE id = ?').get(mappingId) as IntegrationProjectMapping
  })

  ipcMain.handle('integrations:get-project-mapping', (_event, projectId: string, provider: 'linear') => {
    const row = db.prepare(`
      SELECT * FROM integration_project_mappings
      WHERE project_id = ? AND provider = ?
    `).get(projectId, provider) as IntegrationProjectMapping | undefined
    return row ?? null
  })

  ipcMain.handle('integrations:list-linear-issues', async (_event, input: ListLinearIssuesInput) => {
    const connection = getConnection(db, input.connectionId)
    const apiKey = readCredential(db, connection.credential_ref)
    const mapping = input.projectId
      ? db.prepare(`
          SELECT * FROM integration_project_mappings
          WHERE project_id = ? AND provider = 'linear'
        `).get(input.projectId) as IntegrationProjectMapping | undefined
      : undefined

    const data = await listIssues(apiKey, {
      teamId: input.teamId ?? mapping?.external_team_id,
      projectId: input.linearProjectId ?? mapping?.external_project_id ?? undefined,
      first: input.limit ?? 50,
      after: input.cursor ?? null
    })

    const externalIds = data.issues.map((i) => i.id)
    if (externalIds.length > 0) {
      const placeholders = externalIds.map(() => '?').join(',')
      const links = db.prepare(`
        SELECT external_id, task_id FROM external_links
        WHERE provider = 'linear' AND external_id IN (${placeholders})
      `).all(...externalIds) as Array<{ external_id: string; task_id: string }>
      const linkMap = new Map(links.map((l) => [l.external_id, l.task_id]))
      for (const issue of data.issues) {
        issue.linkedTaskId = linkMap.get(issue.id) ?? null
      }
    }

    return data
  })

  ipcMain.handle('integrations:import-linear-issues', async (_event, input: ImportLinearIssuesInput) => {
    const connection = getConnection(db, input.connectionId)
    const mapping = db.prepare(`
      SELECT * FROM integration_project_mappings
      WHERE project_id = ? AND provider = 'linear'
    `).get(input.projectId) as IntegrationProjectMapping | undefined

    const teamId = input.teamId ?? mapping?.external_team_id
    if (!teamId) {
      throw new Error('No team specified and project is not mapped to Linear')
    }

    const apiKey = readCredential(db, connection.credential_ref)
    const data = await listIssues(apiKey, {
      teamId,
      projectId: input.linearProjectId ?? mapping?.external_project_id ?? undefined,
      first: input.limit ?? 25,
      after: input.cursor ?? null
    })

    let imported = 0
    let linked = 0

    const selectedIds = input.selectedIssueIds?.length
      ? new Set(input.selectedIssueIds)
      : null

    for (const issue of data.issues) {
      if (selectedIds && !selectedIds.has(issue.id)) continue
      const taskId = upsertTaskFromIssue(db, input.projectId, issue)
      upsertLinkForIssue(db, issue, input.connectionId, taskId)
      imported += 1
      linked += 1
    }

    const result: ImportLinearIssuesResult = {
      imported,
      linked,
      nextCursor: data.nextCursor
    }

    return result
  })

  ipcMain.handle('integrations:sync-now', async (_event, input: SyncNowInput) => {
    return runSyncNow(db, input)
  })

  ipcMain.handle('integrations:get-link', (_event, taskId: string, provider: 'linear') => {
    const row = db.prepare(`
      SELECT * FROM external_links
      WHERE task_id = ? AND provider = ?
    `).get(taskId, provider) as ExternalLink | undefined
    return row ?? null
  })

  ipcMain.handle('integrations:unlink-task', (_event, taskId: string, provider: 'linear') => {
    db.prepare(`
      DELETE FROM external_field_state
      WHERE external_link_id IN (
        SELECT id FROM external_links WHERE task_id = ? AND provider = ?
      )
    `).run(taskId, provider)

    const res = db.prepare('DELETE FROM external_links WHERE task_id = ? AND provider = ?').run(taskId, provider)
    return res.changes > 0
  })
}
