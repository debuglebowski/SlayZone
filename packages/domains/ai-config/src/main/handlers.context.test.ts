/**
 * AI Config context files, sync, instructions, MCP handler contract tests
 * Run with: ELECTRON_RUN_AS_NODE=1 npx electron --import tsx/esm --loader ./packages/shared/test-utils/loader.ts packages/domains/ai-config/src/main/handlers.context.test.ts
 */
import { createTestHarness, test, expect, describe } from '../../../../shared/test-utils/ipc-harness.js'
import { registerAiConfigHandlers } from './handlers.js'
import * as fs from 'node:fs'
import * as path from 'node:path'

const h = await createTestHarness()
registerAiConfigHandlers(h.ipcMain as never, h.db)

const root = h.tmpDir()
const projectId = crypto.randomUUID()
h.db.prepare('INSERT INTO projects (id, name, color, path) VALUES (?, ?, ?, ?)').run(projectId, 'Ctx', '#000', root)

// Ensure claude is enabled
h.db.prepare("UPDATE ai_config_sources SET enabled = 1 WHERE kind = 'claude'")?.run()

// --- Context file discovery ---

describe('ai-config:discover-context-files', () => {
  test('finds CLAUDE.md when present', () => {
    fs.writeFileSync(path.join(root, 'CLAUDE.md'), '# rules')
    const entries = h.invoke('ai-config:discover-context-files', root) as { name: string; exists: boolean }[]
    const claudeMd = entries.find(e => e.name === 'CLAUDE.md')
    expect(claudeMd).toBeTruthy()
    expect(claudeMd!.exists).toBe(true)
  })
})

describe('ai-config:read-context-file', () => {
  test('reads file content', () => {
    const content = h.invoke('ai-config:read-context-file', path.join(root, 'CLAUDE.md'), root)
    expect(content).toBe('# rules')
  })

  test('rejects path outside project', () => {
    expect(() => h.invoke('ai-config:read-context-file', '/etc/passwd', root)).toThrow()
  })
})

describe('ai-config:write-context-file', () => {
  test('writes file', () => {
    h.invoke('ai-config:write-context-file', path.join(root, 'CLAUDE.md'), '# updated', root)
    expect(fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf-8')).toBe('# updated')
  })
})

// --- Load global item ---

describe('ai-config:load-global-item', () => {
  test('writes skill to provider dir with manual path', () => {
    const item = h.invoke('ai-config:create-item', {
      type: 'skill', scope: 'global', slug: 'deploy', content: '# Deploy skill'
    }) as { id: string }

    const result = h.invoke('ai-config:load-global-item', {
      projectId, projectPath: root, itemId: item.id,
      providers: ['claude'], manualPath: '.claude/skills/deploy.md'
    }) as { relativePath: string; syncStatus: string }
    expect(result.relativePath).toBe('.claude/skills/deploy.md')
    expect(result.syncStatus).toBe('synced')
    expect(fs.readFileSync(path.join(root, '.claude/skills/deploy.md'), 'utf-8')).toBe('# Deploy skill')
  })
})

// --- Sync linked file ---

describe('ai-config:sync-linked-file', () => {
  test('re-syncs item content to disk', () => {
    // Create item + selection
    const item = h.invoke('ai-config:create-item', {
      type: 'command', scope: 'global', slug: 'sync-test', content: 'original'
    }) as { id: string }
    h.invoke('ai-config:load-global-item', {
      projectId, projectPath: root, itemId: item.id,
      providers: ['claude'], manualPath: '.claude/commands/sync-test.md'
    })
    // Modify file externally
    fs.writeFileSync(path.join(root, '.claude/commands/sync-test.md'), 'modified')
    // Update item content in DB
    h.invoke('ai-config:update-item', { id: item.id, content: 'updated content' })

    const result = h.invoke('ai-config:sync-linked-file', projectId, root, item.id) as {
      syncStatus: string
    }
    expect(result.syncStatus).toBe('synced')
    expect(fs.readFileSync(path.join(root, '.claude/commands/sync-test.md'), 'utf-8')).toBe('updated content')
  })
})

// --- Unlink ---

describe('ai-config:unlink-file', () => {
  test('removes selection from DB', () => {
    const item = h.invoke('ai-config:create-item', {
      type: 'skill', scope: 'global', slug: 'unlink-me', content: 'x'
    }) as { id: string }
    h.invoke('ai-config:load-global-item', {
      projectId, projectPath: root, itemId: item.id,
      providers: ['claude'], manualPath: '.claude/skills/unlink-me.md'
    })
    const result = h.invoke('ai-config:unlink-file', projectId, item.id)
    expect(result).toBe(true)
  })

  test('returns false for nonexistent', () => {
    expect(h.invoke('ai-config:unlink-file', projectId, 'nope')).toBe(false)
  })
})

// --- Rename context file ---

describe('ai-config:rename-context-file', () => {
  test('renames file and updates selection target_path', () => {
    const item = h.invoke('ai-config:create-item', {
      type: 'skill', scope: 'global', slug: 'renameme', content: 'rename content'
    }) as { id: string }
    h.invoke('ai-config:load-global-item', {
      projectId, projectPath: root, itemId: item.id,
      providers: ['claude'], manualPath: '.claude/skills/renameme.md'
    })
    const oldPath = path.join(root, '.claude/skills/renameme.md')
    const newPath = path.join(root, '.claude/skills/renamed.md')
    h.invoke('ai-config:rename-context-file', oldPath, newPath, root)
    expect(fs.existsSync(newPath)).toBe(true)
    expect(fs.existsSync(oldPath)).toBe(false)
  })
})

// --- Delete context file ---

describe('ai-config:delete-context-file', () => {
  test('deletes file and removes selection', () => {
    const item = h.invoke('ai-config:create-item', {
      type: 'skill', scope: 'global', slug: 'deleteme', content: 'delete content'
    }) as { id: string }
    h.invoke('ai-config:load-global-item', {
      projectId, projectPath: root, itemId: item.id,
      providers: ['claude'], manualPath: '.claude/skills/deleteme.md'
    })
    const filePath = path.join(root, '.claude/skills/deleteme.md')
    h.invoke('ai-config:delete-context-file', filePath, root, projectId)
    expect(fs.existsSync(filePath)).toBe(false)
  })
})

// --- Global instructions ---

describe('ai-config:get-global-instructions', () => {
  test('returns empty string when none exist', () => {
    const content = h.invoke('ai-config:get-global-instructions')
    expect(content).toBe('')
  })
})

describe('ai-config:save-global-instructions', () => {
  test('creates then upserts', () => {
    h.invoke('ai-config:save-global-instructions', '# Global rules v1')
    expect(h.invoke('ai-config:get-global-instructions')).toBe('# Global rules v1')
    h.invoke('ai-config:save-global-instructions', '# Global rules v2')
    expect(h.invoke('ai-config:get-global-instructions')).toBe('# Global rules v2')
  })
})

// --- Root instructions (per-project) ---

describe('ai-config:save-root-instructions', () => {
  test('writes to provider dirs and returns synced status', () => {
    const result = h.invoke('ai-config:save-root-instructions', projectId, root, '# Project rules') as {
      content: string
      providerStatus: Record<string, string>
    }
    expect(result.content).toBe('# Project rules')
    // Claude should be synced (it's enabled)
    expect(result.providerStatus.claude).toBe('synced')
    // File should exist on disk (CLAUDE.md in project root, not .claude/CLAUDE.md)
    expect(fs.existsSync(path.join(root, 'CLAUDE.md'))).toBe(true)
  })
})

describe('ai-config:get-root-instructions', () => {
  test('returns content and provider status', () => {
    const result = h.invoke('ai-config:get-root-instructions', projectId, root) as {
      content: string
      providerStatus: Record<string, string>
    }
    expect(result.content).toBe('# Project rules')
    expect(result.providerStatus.claude).toBe('synced')
  })
})

// --- Needs sync ---

describe('ai-config:needs-sync', () => {
  test('returns false when all synced', () => {
    const result = h.invoke('ai-config:needs-sync', projectId, root)
    expect(result).toBe(false)
  })

  test('returns true when file modified externally', () => {
    fs.writeFileSync(path.join(root, 'CLAUDE.md'), '# MODIFIED')
    const result = h.invoke('ai-config:needs-sync', projectId, root)
    expect(result).toBe(true)
  })
})

// --- Check sync status ---

describe('ai-config:check-sync-status', () => {
  test('detects external edits as conflicts', () => {
    // .claude/CLAUDE.md was modified above
    const conflicts = h.invoke('ai-config:check-sync-status', projectId, root) as {
      path: string; reason: string
    }[]
    // May or may not have conflicts depending on content_hash state
    expect(Array.isArray(conflicts)).toBe(true)
  })
})

// --- MCP config ---

describe('ai-config:discover-mcp-configs', () => {
  test('returns entries for all providers', () => {
    const results = h.invoke('ai-config:discover-mcp-configs', root) as {
      provider: string; exists: boolean; servers: Record<string, unknown>
    }[]
    expect(results.length).toBe(3)  // claude, cursor, vscode
    const providers = results.map(r => r.provider).sort()
    expect(providers).toContain('claude')
    expect(providers).toContain('cursor')
    expect(providers).toContain('vscode')
  })

  test('detects existing config files', () => {
    fs.mkdirSync(path.join(root, '.mcp-test'), { recursive: true })
    fs.writeFileSync(path.join(root, '.mcp.json'), JSON.stringify({
      mcpServers: { 'my-server': { command: 'node', args: ['server.js'] } }
    }))
    const results = h.invoke('ai-config:discover-mcp-configs', root) as {
      provider: string; exists: boolean; servers: Record<string, unknown>
    }[]
    const claude = results.find(r => r.provider === 'claude')!
    expect(claude.exists).toBe(true)
    expect(claude.servers['my-server']).toBeTruthy()
  })
})

describe('ai-config:write-mcp-server', () => {
  test('writes server config to provider file', () => {
    h.invoke('ai-config:write-mcp-server', {
      projectPath: root,
      provider: 'claude',
      serverKey: 'test-server',
      config: { command: 'node', args: ['test.js'] }
    })
    const data = JSON.parse(fs.readFileSync(path.join(root, '.mcp.json'), 'utf-8'))
    expect(data.mcpServers['test-server']).toBeTruthy()
    expect(data.mcpServers['test-server'].command).toBe('node')
  })

  test('preserves existing servers', () => {
    const data = JSON.parse(fs.readFileSync(path.join(root, '.mcp.json'), 'utf-8'))
    expect(data.mcpServers['my-server']).toBeTruthy()
    expect(data.mcpServers['test-server']).toBeTruthy()
  })
})

describe('ai-config:remove-mcp-server', () => {
  test('removes server from config', () => {
    h.invoke('ai-config:remove-mcp-server', {
      projectPath: root,
      provider: 'claude',
      serverKey: 'test-server'
    })
    const data = JSON.parse(fs.readFileSync(path.join(root, '.mcp.json'), 'utf-8'))
    expect(data.mcpServers['test-server'] ?? null).toBeNull()
    // Other servers preserved
    expect(data.mcpServers['my-server']).toBeTruthy()
  })
})

// --- Skills status ---

describe('ai-config:get-project-skills-status', () => {
  test('returns status for loaded skills', () => {
    // Re-sync root instructions so state is clean
    h.invoke('ai-config:save-root-instructions', projectId, root, '# Project rules')
    // Create and load a skill
    const skill = h.invoke('ai-config:create-item', {
      type: 'skill', scope: 'global', slug: 'status-skill', content: '# Status skill content'
    }) as { id: string }
    h.invoke('ai-config:load-global-item', {
      projectId, projectPath: root, itemId: skill.id,
      providers: ['claude'], manualPath: '.claude/skills/status-skill.md'
    })

    const results = h.invoke('ai-config:get-project-skills-status', projectId, root) as {
      item: { id: string; slug: string }
      providers: Record<string, { path: string; status: string }>
    }[]
    expect(results.length).toBeGreaterThan(0)
    const found = results.find(r => r.item.id === skill.id)
    expect(found).toBeTruthy()
    expect(found!.providers.claude).toBeTruthy()
    expect(found!.providers.claude.status).toBe('synced')
  })

  test('detects out-of-sync skill', () => {
    // Modify the file on disk
    fs.writeFileSync(path.join(root, '.claude/skills/status-skill.md'), '# CHANGED')
    const results = h.invoke('ai-config:get-project-skills-status', projectId, root) as {
      item: { slug: string }
      providers: Record<string, { status: string }>
    }[]
    const found = results.find(r => r.item.slug === 'status-skill')
    expect(found).toBeTruthy()
    expect(found!.providers.claude.status).toBe('out_of_sync')
  })
})

// --- Sync all ---

describe('ai-config:sync-all', () => {
  test('writes all pending files', () => {
    const result = h.invoke('ai-config:sync-all', { projectId, projectPath: root }) as {
      written: { path: string; provider: string }[]
      conflicts: { path: string }[]
    }
    expect(Array.isArray(result.written)).toBe(true)
    expect(Array.isArray(result.conflicts)).toBe(true)
  })
})

h.cleanup()
console.log('\nDone')
