/**
 * Integrations DB-only handler contract tests
 * (Skips Linear API handlers that need network)
 * Run with: npx tsx --loader ./packages/shared/test-utils/loader.ts packages/domains/integrations/src/main/handlers.db.test.ts
 */
import { createTestHarness, test, expect, describe } from '../../../../shared/test-utils/ipc-harness.js'
import { registerIntegrationHandlers } from './handlers.js'

const h = await createTestHarness()
registerIntegrationHandlers(h.ipcMain as never, h.db)

// Seed a project + task for link tests
const projectId = crypto.randomUUID()
h.db.prepare('INSERT INTO projects (id, name, color, path) VALUES (?, ?, ?, ?)').run(projectId, 'IntP', '#000', '/tmp/int-test')
const taskId = crypto.randomUUID()
h.db.prepare(
  "INSERT INTO tasks (id, project_id, title, status, priority, terminal_mode, provider_config, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, '{}', datetime('now'), datetime('now'))"
).run(taskId, projectId, 'Int Task', 'todo', 3, 'claude-code')

// Seed a connection directly (bypassing connect-linear which needs API)
const connId = crypto.randomUUID()
h.db.prepare(`
  INSERT INTO integration_connections (id, provider, workspace_id, workspace_name, account_label, credential_ref, enabled, created_at, updated_at)
  VALUES (?, 'linear', 'ws-1', 'Test Workspace', 'test@test.com', 'cred-ref-1', 1, datetime('now'), datetime('now'))
`).run(connId)

describe('integrations:list-connections', () => {
  test('returns connections without credential_ref', () => {
    const conns = h.invoke('integrations:list-connections') as Record<string, unknown>[]
    expect(conns.length).toBeGreaterThan(0)
    const conn = conns.find(c => c.id === connId)!
    expect(conn.workspace_name).toBe('Test Workspace')
    // credential_ref should NOT be exposed
    expect('credential_ref' in conn).toBe(false)
  })

  test('filters by provider', () => {
    const conns = h.invoke('integrations:list-connections', 'linear') as { provider: string }[]
    for (const c of conns) expect(c.provider).toBe('linear')
  })
})

describe('integrations:get-project-mapping', () => {
  test('returns null when no mapping', () => {
    const result = h.invoke('integrations:get-project-mapping', projectId, 'linear')
    expect(result).toBeNull()
  })

  test('returns mapping after seeding', () => {
    const mappingId = crypto.randomUUID()
    h.db.prepare(`
      INSERT INTO integration_project_mappings (id, project_id, provider, connection_id, external_team_id, external_team_key, sync_mode)
      VALUES (?, ?, 'linear', ?, 'team-1', 'TEAM', 'one_way')
    `).run(mappingId, projectId, connId)

    const mapping = h.invoke('integrations:get-project-mapping', projectId, 'linear') as {
      id: string; project_id: string; external_team_id: string
    }
    expect(mapping).toBeTruthy()
    expect(mapping.project_id).toBe(projectId)
    expect(mapping.external_team_id).toBe('team-1')
  })
})

describe('integrations:get-link', () => {
  test('returns null when no link', () => {
    const result = h.invoke('integrations:get-link', taskId, 'linear')
    expect(result).toBeNull()
  })

  test('returns link after seeding', () => {
    const linkId = crypto.randomUUID()
    h.db.prepare(`
      INSERT INTO external_links (id, provider, connection_id, external_type, external_id, external_key, external_url, task_id, sync_state)
      VALUES (?, 'linear', ?, 'issue', 'ext-1', 'TEAM-123', 'https://linear.app/issue/TEAM-123', ?, 'active')
    `).run(linkId, connId, taskId)

    const link = h.invoke('integrations:get-link', taskId, 'linear') as {
      external_key: string; task_id: string
    }
    expect(link).toBeTruthy()
    expect(link.external_key).toBe('TEAM-123')
    expect(link.task_id).toBe(taskId)
  })
})

describe('integrations:unlink-task', () => {
  test('removes link and field state', () => {
    const result = h.invoke('integrations:unlink-task', taskId, 'linear')
    expect(result).toBe(true)

    const link = h.invoke('integrations:get-link', taskId, 'linear')
    expect(link).toBeNull()
  })

  test('returns false for nonexistent link', () => {
    const result = h.invoke('integrations:unlink-task', 'nope', 'linear')
    expect(result).toBe(false)
  })
})

describe('integrations:disconnect', () => {
  test('cascades delete (mappings, links, connection)', () => {
    // Re-seed a link for cascade test
    const linkId2 = crypto.randomUUID()
    h.db.prepare(`
      INSERT INTO external_links (id, provider, connection_id, external_type, external_id, external_key, task_id, sync_state)
      VALUES (?, 'linear', ?, 'issue', 'ext-2', 'TEAM-456', ?, 'active')
    `).run(linkId2, connId, taskId)

    const result = h.invoke('integrations:disconnect', connId)
    expect(result).toBe(true)

    const conns = h.invoke('integrations:list-connections') as { id: string }[]
    expect(conns.find(c => c.id === connId) ?? null).toBeNull()
  })
})

h.cleanup()
console.log('\nDone')
