/**
 * AI Config selections + providers handler contract tests
 * Run with: npx tsx --loader ./packages/shared/test-utils/loader.ts packages/domains/ai-config/src/main/handlers.selections.test.ts
 */
import { createTestHarness, test, expect, describe } from '../../../../shared/test-utils/ipc-harness.js'
import { registerAiConfigHandlers } from './handlers.js'

const h = await createTestHarness()
registerAiConfigHandlers(h.ipcMain as never, h.db)

// Seed project + item
const projectId = crypto.randomUUID()
h.db.prepare('INSERT INTO projects (id, name, color, path) VALUES (?, ?, ?, ?)').run(projectId, 'P', '#000', '/tmp/test-proj')
const item = h.invoke('ai-config:create-item', { type: 'skill', scope: 'global', slug: 'sel-test', content: 'x' }) as { id: string }
const item2 = h.invoke('ai-config:create-item', { type: 'command', scope: 'global', slug: 'sel-test-2', content: 'y' }) as { id: string }

// --- Selections ---

describe('ai-config:set-project-selection', () => {
  test('creates selection', () => {
    h.invoke('ai-config:set-project-selection', { projectId, itemId: item.id, targetPath: '.claude/skills/sel-test.md' })
    const sels = h.invoke('ai-config:list-project-selections', projectId) as { item_id: string; target_path: string }[]
    expect(sels).toHaveLength(1)
    expect(sels[0].item_id).toBe(item.id)
    expect(sels[0].target_path).toBe('.claude/skills/sel-test.md')
  })

  test('upserts on conflict (same project+item+provider)', () => {
    h.invoke('ai-config:set-project-selection', { projectId, itemId: item.id, targetPath: '.claude/skills/updated.md' })
    const sels = h.invoke('ai-config:list-project-selections', projectId) as { target_path: string }[]
    // Should still be 1 selection (upserted, not duplicated)
    expect(sels.filter(s => s.target_path === '.claude/skills/updated.md')).toHaveLength(1)
  })

  test('allows multiple items per project', () => {
    h.invoke('ai-config:set-project-selection', { projectId, itemId: item2.id, targetPath: '.claude/commands/test.md' })
    const sels = h.invoke('ai-config:list-project-selections', projectId) as unknown[]
    expect(sels.length).toBeGreaterThan(1)
  })
})

describe('ai-config:list-project-selections', () => {
  test('returns empty for unknown project', () => {
    const sels = h.invoke('ai-config:list-project-selections', 'nonexistent') as unknown[]
    expect(sels).toHaveLength(0)
  })
})

describe('ai-config:remove-project-selection', () => {
  test('removes by project+item (all providers)', () => {
    const result = h.invoke('ai-config:remove-project-selection', projectId, item2.id)
    expect(result).toBe(true)
  })

  test('returns false for nonexistent', () => {
    const result = h.invoke('ai-config:remove-project-selection', projectId, 'nope')
    expect(result).toBe(false)
  })

  test('removes by project+item+provider', () => {
    const result = h.invoke('ai-config:remove-project-selection', projectId, item.id, 'claude')
    expect(result).toBe(true)
    const sels = h.invoke('ai-config:list-project-selections', projectId) as unknown[]
    expect(sels).toHaveLength(0)
  })
})

// --- Providers ---

describe('ai-config:list-providers', () => {
  test('returns seeded providers', () => {
    const providers = h.invoke('ai-config:list-providers') as { name: string; kind: string; enabled: number }[]
    expect(providers.length).toBeGreaterThan(0)
    const claude = providers.find(p => p.kind === 'claude')
    expect(claude).toBeTruthy()
    expect(claude!.enabled).toBe(1)
  })
})

describe('ai-config:toggle-provider', () => {
  test('disables provider', () => {
    h.invoke('ai-config:toggle-provider', 'provider-claude', false)
    const providers = h.invoke('ai-config:list-providers') as { kind: string; enabled: number }[]
    const claude = providers.find(p => p.kind === 'claude')
    expect(claude!.enabled).toBe(0)
  })

  test('enables provider', () => {
    h.invoke('ai-config:toggle-provider', 'provider-claude', true)
    const providers = h.invoke('ai-config:list-providers') as { kind: string; enabled: number }[]
    const claude = providers.find(p => p.kind === 'claude')
    expect(claude!.enabled).toBe(1)
  })
})

describe('ai-config:get-project-providers', () => {
  test('returns default providers (falls back to global)', () => {
    const providers = h.invoke('ai-config:get-project-providers', projectId) as string[]
    // Should include enabled global providers
    expect(providers).toContain('claude')
  })
})

describe('ai-config:set-project-providers', () => {
  test('sets project-specific providers', () => {
    h.invoke('ai-config:set-project-providers', projectId, ['claude', 'codex'])
    const providers = h.invoke('ai-config:get-project-providers', projectId) as string[]
    expect(providers).toContain('claude')
    expect(providers).toContain('codex')
  })
})

h.cleanup()
console.log('\nDone')
