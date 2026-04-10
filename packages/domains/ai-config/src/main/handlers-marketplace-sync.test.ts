/**
 * Tests for marketplace install-skill + sync-linked-file integration.
 * Verifies that after installing a skill to a project, syncing writes files to disk.
 *
 * Run: ELECTRON_RUN_AS_NODE=1 pnpm exec electron --import tsx/esm --loader ./packages/shared/test-utils/loader.ts packages/domains/ai-config/src/main/handlers-marketplace-sync.test.ts
 */
import { createTestHarness, test, expect, describe, type TestHarness } from '../../../../shared/test-utils/ipc-harness.js'
import { registerAiConfigHandlers } from './handlers.js'
import * as fs from 'node:fs'
import * as path from 'node:path'

type AiConfigItem = { id: string; slug: string; scope: string; project_id: string | null; content: string }

function seedProject(h: TestHarness, providers: string[] = ['claude']) {
  const projectId = crypto.randomUUID()
  const projectPath = h.tmpDir()
  h.db.prepare('INSERT INTO projects (id, name, color, path) VALUES (?, ?, ?, ?)').run(projectId, 'TestProj', '#000', projectPath)
  h.db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(
    `ai_providers:${projectId}`, JSON.stringify(providers)
  )
  return { projectId, projectPath }
}

// ---------------------------------------------------------------------------
// install-skill + sync-linked-file writes files
// ---------------------------------------------------------------------------

const h1 = await createTestHarness()
registerAiConfigHandlers(h1.ipcMain as never, h1.db)
const p1 = seedProject(h1)

// Get a builtin entry ID for testing
const builtinEntry = h1.db.prepare(`
  SELECT id, slug, content FROM skill_registry_entries WHERE registry_id = 'builtin-slayzone' LIMIT 1
`).get() as { id: string; slug: string; content: string }

describe('install-skill + sync-linked-file', () => {
  test('install with scope=project creates DB record', () => {
    const item = h1.invoke('ai-config:marketplace:install-skill', {
      entryId: builtinEntry.id,
      scope: 'project',
      projectId: p1.projectId
    }) as AiConfigItem
    expect(item.scope).toBe('project')
    expect(item.project_id).toBe(p1.projectId)
    expect(item.slug).toBe(builtinEntry.slug)
  })

  test('sync-linked-file writes skill to disk after install', () => {
    // The item was installed in the previous test — find it
    const items = h1.invoke('ai-config:list-items', {
      scope: 'project', projectId: p1.projectId, type: 'skill'
    }) as AiConfigItem[]
    const item = items.find(i => i.slug === builtinEntry.slug)
    expect(item).toBeTruthy()

    // Sync to disk
    h1.invoke('ai-config:sync-linked-file', p1.projectId, p1.projectPath, item!.id)

    // Verify file exists
    const filePath = path.join(p1.projectPath, '.claude', 'skills', builtinEntry.slug, 'SKILL.md')
    expect(fs.existsSync(filePath)).toBe(true)

    // Verify content contains the skill body
    const content = fs.readFileSync(filePath, 'utf-8')
    expect(content.length > 0).toBe(true)
  })

  test('install-skill throws on duplicate', () => {
    let threw = false
    try {
      h1.invoke('ai-config:marketplace:install-skill', {
        entryId: builtinEntry.id,
        scope: 'project',
        projectId: p1.projectId
      })
    } catch (e) {
      threw = true
      expect((e as Error).message).toBe('Skill already installed')
    }
    expect(threw).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// global scope — no project files
// ---------------------------------------------------------------------------

const h2 = await createTestHarness()
registerAiConfigHandlers(h2.ipcMain as never, h2.db)
const p2 = seedProject(h2)

const globalEntry = h2.db.prepare(`
  SELECT id, slug FROM skill_registry_entries WHERE registry_id = 'builtin-slayzone' LIMIT 1
`).get() as { id: string; slug: string }

describe('install-skill with scope=global', () => {
  test('creates DB record with scope=global', () => {
    const item = h2.invoke('ai-config:marketplace:install-skill', {
      entryId: globalEntry.id,
      scope: 'global'
    }) as AiConfigItem
    expect(item.scope).toBe('global')
    expect(item.project_id).toBeNull()
  })

  test('no skill files written to project dir', () => {
    const skillsDir = path.join(p2.projectPath, '.claude', 'skills')
    expect(fs.existsSync(skillsDir)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// sync writes to multiple providers
// ---------------------------------------------------------------------------

const h3 = await createTestHarness()
registerAiConfigHandlers(h3.ipcMain as never, h3.db)
const p3 = seedProject(h3, ['claude', 'cursor'])

const multiEntry = h3.db.prepare(`
  SELECT id, slug FROM skill_registry_entries WHERE registry_id = 'builtin-slayzone' LIMIT 1
`).get() as { id: string; slug: string }

describe('sync writes to multiple providers', () => {
  test('sync-linked-file writes to all enabled providers', () => {
    const item = h3.invoke('ai-config:marketplace:install-skill', {
      entryId: multiEntry.id,
      scope: 'project',
      projectId: p3.projectId
    }) as AiConfigItem

    h3.invoke('ai-config:sync-linked-file', p3.projectId, p3.projectPath, item.id)

    expect(fs.existsSync(path.join(p3.projectPath, '.claude', 'skills', multiEntry.slug, 'SKILL.md'))).toBe(true)
    expect(fs.existsSync(path.join(p3.projectPath, '.cursor', 'skills', multiEntry.slug, 'SKILL.md'))).toBe(true)
  })
})

h1.cleanup()
h2.cleanup()
h3.cleanup()
console.log('\nDone')
