/**
 * AI Config items handler contract tests
 * Run with: npx tsx --loader ./packages/shared/test-utils/loader.ts packages/domains/ai-config/src/main/handlers.items.test.ts
 */
import { createTestHarness, test, expect, describe } from '../../../../shared/test-utils/ipc-harness.js'
import { registerAiConfigHandlers } from './handlers.js'

const h = await createTestHarness()
registerAiConfigHandlers(h.ipcMain as never, h.db)

// Seed a project for project-scoped items
const projectId = crypto.randomUUID()
h.db.prepare('INSERT INTO projects (id, name, color) VALUES (?, ?, ?)').run(projectId, 'P', '#000')

let globalItemId: string
let projectItemId: string

describe('ai-config:create-item', () => {
  test('creates global item', () => {
    const item = h.invoke('ai-config:create-item', {
      type: 'skill', scope: 'global', slug: 'My Skill!', content: '# Skill content'
    }) as { id: string; type: string; scope: string; slug: string; name: string; content: string; project_id: null }
    expect(item.type).toBe('skill')
    expect(item.scope).toBe('global')
    expect(item.slug).toBe('my-skill')
    expect(item.name).toBe('my-skill')
    expect(item.content).toBe('# Skill content')
    expect(item.project_id).toBeNull()
    globalItemId = item.id
  })

  test('creates project-scoped item', () => {
    const item = h.invoke('ai-config:create-item', {
      type: 'command', scope: 'project', projectId, slug: 'deploy', content: 'run deploy'
    }) as { id: string; project_id: string; scope: string }
    expect(item.scope).toBe('project')
    expect(item.project_id).toBe(projectId)
    projectItemId = item.id
  })

  test('normalizes slug', () => {
    const item = h.invoke('ai-config:create-item', {
      type: 'skill', scope: 'global', slug: '  --Hello World!! --', content: ''
    }) as { slug: string }
    expect(item.slug).toBe('hello-world')
  })

  test('empty slug becomes untitled', () => {
    const item = h.invoke('ai-config:create-item', {
      type: 'skill', scope: 'global', slug: '!!!', content: ''
    }) as { slug: string }
    expect(item.slug).toBe('untitled')
  })
})

describe('ai-config:get-item', () => {
  test('returns item by id', () => {
    const item = h.invoke('ai-config:get-item', globalItemId) as { id: string }
    expect(item.id).toBe(globalItemId)
  })

  test('returns null for nonexistent', () => {
    expect(h.invoke('ai-config:get-item', 'nope')).toBeNull()
  })
})

describe('ai-config:list-items', () => {
  test('filters by scope', () => {
    const items = h.invoke('ai-config:list-items', { scope: 'global' }) as { scope: string }[]
    for (const item of items) expect(item.scope).toBe('global')
  })

  test('filters by scope + type', () => {
    const items = h.invoke('ai-config:list-items', { scope: 'global', type: 'skill' }) as { type: string }[]
    for (const item of items) expect(item.type).toBe('skill')
    expect(items.length).toBeGreaterThan(0)
  })

  test('filters by scope + project', () => {
    const items = h.invoke('ai-config:list-items', { scope: 'project', projectId }) as { project_id: string }[]
    expect(items).toHaveLength(1)
    expect(items[0].project_id).toBe(projectId)
  })
})

describe('ai-config:update-item', () => {
  test('updates content', () => {
    const item = h.invoke('ai-config:update-item', { id: globalItemId, content: 'updated content' }) as { content: string }
    expect(item.content).toBe('updated content')
  })

  test('updates slug (normalized)', () => {
    const item = h.invoke('ai-config:update-item', { id: globalItemId, slug: 'New Name!!' }) as { slug: string; name: string }
    expect(item.slug).toBe('new-name')
    expect(item.name).toBe('new-name')
  })

  test('updates scope to global clears project_id', () => {
    const item = h.invoke('ai-config:update-item', { id: projectItemId, scope: 'global' }) as { scope: string; project_id: null }
    expect(item.scope).toBe('global')
    expect(item.project_id).toBeNull()
  })

  test('returns null for nonexistent', () => {
    expect(h.invoke('ai-config:update-item', { id: 'nope', content: 'x' })).toBeNull()
  })
})

describe('ai-config:delete-item', () => {
  test('deletes existing', () => {
    expect(h.invoke('ai-config:delete-item', globalItemId)).toBe(true)
    expect(h.invoke('ai-config:get-item', globalItemId)).toBeNull()
  })

  test('returns false for nonexistent', () => {
    expect(h.invoke('ai-config:delete-item', 'nope')).toBe(false)
  })
})

h.cleanup()
console.log('\nDone')
