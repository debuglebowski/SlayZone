import * as fs from 'node:fs'
import * as path from 'node:path'
import { createHash } from 'node:crypto'
import { app } from 'electron'
import type { IpcMain } from 'electron'
import type { Database } from 'better-sqlite3'
import type {
  AiConfigItem,
  AiConfigProjectSelection,
  CliProvider,
  CliProviderInfo,
  ContextFileInfo,
  ContextFileCategory,
  ContextTreeEntry,
  CreateAiConfigItemInput,
  ListAiConfigItemsInput,
  LoadGlobalItemInput,
  McpConfigFileResult,
  McpProvider,
  McpServerConfig,
  ProjectSkillStatus,
  ProviderSyncStatus,
  RootInstructionsResult,
  SetAiConfigProjectSelectionInput,
  SyncAllInput,
  SyncConflict,
  SyncResult,
  UpdateAiConfigItemInput,
  WriteMcpServerInput,
  RemoveMcpServerInput
} from '../shared'
import { PROVIDER_PATHS, GLOBAL_PROVIDER_PATHS } from '../shared/provider-registry'
import type { GlobalFileEntry } from '../shared'

const KNOWN_CONTEXT_FILES: Array<{ relative: string; name: string; category: ContextFileCategory }> = [
  { relative: 'CLAUDE.md', name: 'CLAUDE.md', category: 'claude' },
  { relative: '.claude/CLAUDE.md', name: '.claude/CLAUDE.md', category: 'claude' },
  { relative: 'AGENTS.md', name: 'AGENTS.md', category: 'codex' },
  { relative: '.mcp.json', name: '.mcp.json', category: 'mcp' },
  { relative: '.cursor/mcp.json', name: '.cursor/mcp.json', category: 'mcp' },
  { relative: '.vscode/mcp.json', name: '.vscode/mcp.json', category: 'mcp' }
]

function contentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

function getSkillPath(provider: CliProvider, slug: string): string | null {
  const mapping = PROVIDER_PATHS[provider]
  if (!mapping.skillsDir) return null
  return `${mapping.skillsDir}/${slug}.md`
}

function getCommandPath(provider: CliProvider, slug: string): string | null {
  const mapping = PROVIDER_PATHS[provider]
  if (!mapping.commandsDir) return null
  return `${mapping.commandsDir}/${slug}.md`
}

function isPathAllowed(filePath: string, projectPath: string | null): boolean {
  const resolved = path.resolve(filePath)
  const home = app.getPath('home')
  // Allow all global provider base dirs
  for (const spec of Object.values(GLOBAL_PROVIDER_PATHS)) {
    const dir = path.join(home, spec.baseDir)
    if (resolved.startsWith(dir + path.sep) || resolved === dir) return true
  }
  if (projectPath) {
    const resolvedProject = path.resolve(projectPath)
    if (resolved.startsWith(resolvedProject + path.sep) || resolved === resolvedProject) return true
  }
  return false
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
    const slug = input.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled'
    db.prepare(`
      INSERT INTO ai_config_items (
        id, type, scope, project_id, name, slug, content, metadata_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, '{}', datetime('now'), datetime('now'))
    `).run(
      id,
      input.type,
      input.scope,
      projectId,
      slug,
      slug,
      input.content ?? ''
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
    if (input.slug !== undefined) {
      const slug = input.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled'
      fields.push('slug = ?')
      values.push(slug)
      fields.push('name = ?')
      values.push(slug)
    }
    if (input.content !== undefined) {
      fields.push('content = ?')
      values.push(input.content)
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
        id, project_id, item_id, provider, target_path, selected_at
      ) VALUES (?, ?, ?, 'claude', ?, datetime('now'))
      ON CONFLICT(project_id, item_id, provider) DO UPDATE SET
        target_path = excluded.target_path,
        selected_at = datetime('now')
    `).run(id, input.projectId, input.itemId, input.targetPath)
  })

  ipcMain.handle('ai-config:remove-project-selection', (_event, projectId: string, itemId: string, provider?: string) => {
    if (provider) {
      const result = db.prepare(`
        DELETE FROM ai_config_project_selections
        WHERE project_id = ? AND item_id = ? AND provider = ?
      `).run(projectId, itemId, provider)
      return result.changes > 0
    }
    const result = db.prepare(`
      DELETE FROM ai_config_project_selections
      WHERE project_id = ? AND item_id = ?
    `).run(projectId, itemId)
    return result.changes > 0
  })

  ipcMain.handle('ai-config:discover-context-files', (_event, projectPath: string) => {
    const results: ContextFileInfo[] = []

    // Project-specific files (only if project path provided)
    if (projectPath) {
      const resolvedProject = path.resolve(projectPath)
      for (const spec of KNOWN_CONTEXT_FILES) {
        const filePath = path.join(resolvedProject, spec.relative)
        results.push({
          path: filePath,
          name: spec.name,
          exists: fs.existsSync(filePath),
          category: spec.category
        })
      }
    }

    // ~/.claude/CLAUDE.md (always shown — global config)
    const globalClaude = path.join(app.getPath('home'), '.claude', 'CLAUDE.md')
    results.push({
      path: globalClaude,
      name: '~/.claude/CLAUDE.md',
      exists: fs.existsSync(globalClaude),
      category: 'claude'
    })

    return results
  })

  ipcMain.handle('ai-config:get-global-files', () => {
    const home = app.getPath('home')
    const entries: GlobalFileEntry[] = []

    for (const [provider, spec] of Object.entries(GLOBAL_PROVIDER_PATHS)) {
      const baseDir = path.join(home, spec.baseDir)

      // Instructions file
      if (spec.instructions) {
        const filePath = path.join(baseDir, spec.instructions)
        entries.push({
          path: filePath,
          name: `~/${spec.baseDir}/${spec.instructions}`,
          provider,
          category: 'instructions',
          exists: fs.existsSync(filePath)
        })
      }

      // Skills directory
      if (spec.skillsDir) {
        const dir = path.join(baseDir, spec.skillsDir)
        if (fs.existsSync(dir)) {
          try {
            for (const file of fs.readdirSync(dir)) {
              if (!file.endsWith('.md')) continue
              entries.push({
                path: path.join(dir, file),
                name: `~/${spec.baseDir}/${spec.skillsDir}/${file}`,
                provider,
                category: 'skill',
                exists: true
              })
            }
          } catch { /* ignore permission errors */ }
        }
      }

      // Commands directory
      if (spec.commandsDir) {
        const dir = path.join(baseDir, spec.commandsDir)
        if (fs.existsSync(dir)) {
          try {
            for (const file of fs.readdirSync(dir)) {
              if (!file.endsWith('.md')) continue
              entries.push({
                path: path.join(dir, file),
                name: `~/${spec.baseDir}/${spec.commandsDir}/${file}`,
                provider,
                category: 'command',
                exists: true
              })
            }
          } catch { /* ignore permission errors */ }
        }
      }
    }

    return entries
  })

  ipcMain.handle('ai-config:read-context-file', (_event, filePath: string, projectPath: string) => {
    if (!isPathAllowed(filePath, projectPath)) throw new Error('Path not allowed')
    return fs.readFileSync(filePath, 'utf-8')
  })

  ipcMain.handle('ai-config:write-context-file', (_event, filePath: string, content: string, projectPath: string) => {
    if (!isPathAllowed(filePath, projectPath)) throw new Error('Path not allowed')
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(filePath, content, 'utf-8')
  })

  ipcMain.handle('ai-config:get-context-tree', (_event, projectPath: string, projectId: string) => {
    const entries: ContextTreeEntry[] = []
    const resolvedProject = path.resolve(projectPath)
    const seenPaths = new Set<string>()

    // 1. Discovered known files
    for (const spec of KNOWN_CONTEXT_FILES) {
      const filePath = path.join(resolvedProject, spec.relative)
      seenPaths.add(filePath)
      entries.push({
        path: filePath,
        relativePath: spec.relative,
        exists: fs.existsSync(filePath),
        category: spec.category,
        linkedItemId: null,
        syncStatus: 'local_only'
      })
    }

    // ~/.claude/CLAUDE.md
    const globalClaude = path.join(app.getPath('home'), '.claude', 'CLAUDE.md')
    seenPaths.add(globalClaude)
    entries.push({
      path: globalClaude,
      relativePath: '~/.claude/CLAUDE.md',
      exists: fs.existsSync(globalClaude),
      category: 'claude',
      linkedItemId: null,
      syncStatus: 'local_only'
    })

    // 2. Scan skill/command directories for .md files
    const scanDirs: Array<{ dir: string; relDir: string; category: 'skill' | 'command'; provider?: CliProvider }> = [
      { dir: path.join(resolvedProject, '.claude', 'commands'), relDir: '.claude/commands', category: 'command', provider: 'claude' },
      { dir: path.join(resolvedProject, '.claude', 'skills'), relDir: '.claude/skills', category: 'skill', provider: 'claude' },
      { dir: path.join(resolvedProject, 'agents'), relDir: 'agents', category: 'skill' },
      { dir: path.join(resolvedProject, '.agents', 'skills'), relDir: '.agents/skills', category: 'skill', provider: 'codex' }
    ]
    for (const { dir, relDir, category, provider: scanProvider } of scanDirs) {
      if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
        for (const file of fs.readdirSync(dir)) {
          if (!file.endsWith('.md')) continue
          const filePath = path.join(dir, file)
          if (seenPaths.has(filePath)) continue
          seenPaths.add(filePath)
          entries.push({
            path: filePath,
            relativePath: `${relDir}/${file}`,
            exists: true,
            category,
            provider: scanProvider,
            linkedItemId: null,
            syncStatus: 'local_only'
          })
        }
      }
    }

    // 3. Check project selections for linked global items
    const selections = db.prepare(`
      SELECT ps.*, i.content as item_content
      FROM ai_config_project_selections ps
      JOIN ai_config_items i ON i.id = ps.item_id
      WHERE ps.project_id = ?
    `).all(projectId) as Array<AiConfigProjectSelection & { item_content: string }>

    for (const sel of selections) {
      const filePath = path.isAbsolute(sel.target_path)
        ? sel.target_path
        : path.join(resolvedProject, sel.target_path)

      const existing = entries.find((e) => e.path === filePath)
      if (existing) {
        existing.linkedItemId = sel.item_id
        if (fs.existsSync(filePath)) {
          const fileContent = fs.readFileSync(filePath, 'utf-8')
          existing.syncStatus = fileContent === sel.item_content ? 'synced' : 'out_of_sync'
        } else {
          existing.syncStatus = 'out_of_sync'
        }
      } else {
        const exists = fs.existsSync(filePath)
        let syncStatus: ContextTreeEntry['syncStatus'] = 'out_of_sync'
        if (exists) {
          const fileContent = fs.readFileSync(filePath, 'utf-8')
          syncStatus = fileContent === sel.item_content ? 'synced' : 'out_of_sync'
        }
        seenPaths.add(filePath)
        entries.push({
          path: filePath,
          relativePath: sel.target_path,
          exists,
          category: 'custom',
          linkedItemId: sel.item_id,
          syncStatus
        })
      }
    }

    return entries
  })

  ipcMain.handle('ai-config:load-global-item', (_event, input: LoadGlobalItemInput) => {
    const item = db.prepare('SELECT * FROM ai_config_items WHERE id = ?').get(input.itemId) as AiConfigItem | undefined
    if (!item) throw new Error('Item not found')

    const resolvedProject = path.resolve(input.projectPath)
    const hash = contentHash(item.content)
    const entries: ContextTreeEntry[] = []

    // If manual path provided, write there (no provider-based logic)
    if (input.manualPath) {
      const filePath = path.join(resolvedProject, input.manualPath)
      if (!isPathAllowed(filePath, input.projectPath)) throw new Error('Path not allowed')
      const dir = path.dirname(filePath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(filePath, item.content, 'utf-8')

      db.prepare(`
        INSERT INTO ai_config_project_selections (id, project_id, item_id, provider, target_path, content_hash, selected_at)
        VALUES (?, ?, ?, 'claude', ?, ?, datetime('now'))
        ON CONFLICT(project_id, item_id, provider) DO UPDATE SET
          target_path = excluded.target_path, content_hash = excluded.content_hash, selected_at = datetime('now')
      `).run(crypto.randomUUID(), input.projectId, input.itemId, input.manualPath, hash)

      entries.push({
        path: filePath, relativePath: input.manualPath, exists: true,
        category: item.type === 'skill' ? 'skill' : 'command',
        linkedItemId: item.id, syncStatus: 'synced'
      })
      return entries[0]
    }

    // Write to each selected provider
    for (const provider of input.providers) {
      const relativePath = item.type === 'skill'
        ? getSkillPath(provider, item.slug)
        : getCommandPath(provider, item.slug)
      if (!relativePath) continue

      const filePath = path.join(resolvedProject, relativePath)
      if (!isPathAllowed(filePath, input.projectPath)) continue

      const dir = path.dirname(filePath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(filePath, item.content, 'utf-8')

      db.prepare(`
        INSERT INTO ai_config_project_selections (id, project_id, item_id, provider, target_path, content_hash, selected_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(project_id, item_id, provider) DO UPDATE SET
          target_path = excluded.target_path, content_hash = excluded.content_hash, selected_at = datetime('now')
      `).run(crypto.randomUUID(), input.projectId, input.itemId, provider, relativePath, hash)

      entries.push({
        path: filePath, relativePath, exists: true,
        category: item.type === 'skill' ? 'skill' : 'command',
        provider,
        linkedItemId: item.id, syncStatus: 'synced'
      })
    }

    return entries[0] ?? null
  })

  ipcMain.handle('ai-config:sync-linked-file', (_event, projectId: string, projectPath: string, itemId: string) => {
    const sel = db.prepare(`
      SELECT ps.*, i.content as item_content, i.type as item_type
      FROM ai_config_project_selections ps
      JOIN ai_config_items i ON i.id = ps.item_id
      WHERE ps.project_id = ? AND ps.item_id = ?
    `).get(projectId, itemId) as (AiConfigProjectSelection & { item_content: string; item_type: string }) | undefined
    if (!sel) throw new Error('Selection not found')

    const resolvedProject = path.resolve(projectPath)
    const filePath = path.isAbsolute(sel.target_path)
      ? sel.target_path
      : path.join(resolvedProject, sel.target_path)

    if (!isPathAllowed(filePath, projectPath)) throw new Error('Path not allowed')

    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(filePath, sel.item_content, 'utf-8')

    const entry: ContextTreeEntry = {
      path: filePath,
      relativePath: sel.target_path,
      exists: true,
      category: sel.item_type === 'skill' ? 'skill' : 'command',
      linkedItemId: sel.item_id,
      syncStatus: 'synced'
    }
    return entry
  })

  ipcMain.handle('ai-config:unlink-file', (_event, projectId: string, itemId: string) => {
    const result = db.prepare(`
      DELETE FROM ai_config_project_selections WHERE project_id = ? AND item_id = ?
    `).run(projectId, itemId)
    return result.changes > 0
  })

  ipcMain.handle('ai-config:rename-context-file', (_event, oldPath: string, newPath: string, projectPath: string) => {
    if (!isPathAllowed(oldPath, projectPath)) throw new Error('Path not allowed')
    if (!isPathAllowed(newPath, projectPath)) throw new Error('Path not allowed')
    if (!fs.existsSync(oldPath)) throw new Error('File not found')
    const dir = path.dirname(newPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.renameSync(oldPath, newPath)
    // Update any project selections pointing to old path
    const resolvedProject = path.resolve(projectPath)
    const oldRel = path.relative(resolvedProject, oldPath)
    const newRel = path.relative(resolvedProject, newPath)
    db.prepare(`
      UPDATE ai_config_project_selections SET target_path = ? WHERE target_path = ?
    `).run(newRel, oldRel)
  })

  ipcMain.handle('ai-config:delete-context-file', (_event, filePath: string, projectPath: string, projectId: string) => {
    if (!isPathAllowed(filePath, projectPath)) throw new Error('Path not allowed')
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    // Remove any project selections pointing to this file
    const resolvedProject = path.resolve(projectPath)
    const rel = path.relative(resolvedProject, filePath)
    db.prepare(`
      DELETE FROM ai_config_project_selections WHERE project_id = ? AND target_path = ?
    `).run(projectId, rel)
  })

  // --- Root instructions + skills status ---

  function getEnabledProviders(projectId: string): CliProvider[] {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?')
      .get(`ai_providers:${projectId}`) as { value: string } | undefined
    if (row) return JSON.parse(row.value) as CliProvider[]
    const active = db.prepare('SELECT kind FROM ai_config_sources WHERE enabled = 1 AND status = ?')
      .all('active') as Array<{ kind: string }>
    return active.map(p => p.kind as CliProvider)
  }

  ipcMain.handle('ai-config:get-root-instructions', (_event, projectId: string, projectPath: string) => {
    const item = db.prepare(
      "SELECT * FROM ai_config_items WHERE type = 'root_instructions' AND scope = 'project' AND project_id = ?"
    ).get(projectId) as AiConfigItem | undefined

    const providers = getEnabledProviders(projectId)
    const resolvedProject = path.resolve(projectPath)
    const providerStatus: Partial<Record<CliProvider, ProviderSyncStatus>> = {}

    for (const provider of providers) {
      const rootPath = PROVIDER_PATHS[provider]?.rootInstructions
      if (!rootPath) continue
      const filePath = path.join(resolvedProject, rootPath)
      if (!item) {
        providerStatus[provider] = fs.existsSync(filePath) ? 'out_of_sync' : 'not_synced'
        continue
      }
      if (!fs.existsSync(filePath)) {
        providerStatus[provider] = 'not_synced'
        continue
      }
      const diskHash = contentHash(fs.readFileSync(filePath, 'utf-8'))
      const itemHash = contentHash(item.content)
      providerStatus[provider] = diskHash === itemHash ? 'synced' : 'out_of_sync'
    }

    const result: RootInstructionsResult = {
      content: item?.content ?? '',
      providerStatus
    }
    return result
  })

  ipcMain.handle('ai-config:get-global-instructions', () => {
    const item = db.prepare(
      "SELECT * FROM ai_config_items WHERE type = 'root_instructions' AND scope = 'global'"
    ).get() as AiConfigItem | undefined
    return item?.content ?? ''
  })

  ipcMain.handle('ai-config:save-global-instructions', (_event, content: string) => {
    const existing = db.prepare(
      "SELECT id FROM ai_config_items WHERE type = 'root_instructions' AND scope = 'global'"
    ).get() as { id: string } | undefined

    if (existing) {
      db.prepare("UPDATE ai_config_items SET content = ?, updated_at = datetime('now') WHERE id = ?")
        .run(content, existing.id)
    } else {
      db.prepare(`
        INSERT INTO ai_config_items (id, type, scope, project_id, name, slug, content, metadata_json, created_at, updated_at)
        VALUES (?, 'root_instructions', 'global', NULL, 'root_instructions', 'root_instructions', ?, '{}', datetime('now'), datetime('now'))
      `).run(crypto.randomUUID(), content)
    }
  })

  ipcMain.handle('ai-config:save-root-instructions', (_event, projectId: string, projectPath: string, content: string) => {
    // Upsert the root_instructions item
    const existing = db.prepare(
      "SELECT id FROM ai_config_items WHERE type = 'root_instructions' AND scope = 'project' AND project_id = ?"
    ).get(projectId) as { id: string } | undefined

    let itemId: string
    if (existing) {
      db.prepare("UPDATE ai_config_items SET content = ?, updated_at = datetime('now') WHERE id = ?")
        .run(content, existing.id)
      itemId = existing.id
    } else {
      itemId = crypto.randomUUID()
      db.prepare(`
        INSERT INTO ai_config_items (id, type, scope, project_id, name, slug, content, metadata_json, created_at, updated_at)
        VALUES (?, 'root_instructions', 'project', ?, 'root_instructions', 'root_instructions', ?, '{}', datetime('now'), datetime('now'))
      `).run(itemId, projectId, content)
    }

    const hash = contentHash(content)
    const providers = getEnabledProviders(projectId)
    const resolvedProject = path.resolve(projectPath)
    const providerStatus: Partial<Record<CliProvider, ProviderSyncStatus>> = {}

    for (const provider of providers) {
      const rootPath = PROVIDER_PATHS[provider]?.rootInstructions
      if (!rootPath) continue
      const filePath = path.join(resolvedProject, rootPath)
      if (!isPathAllowed(filePath, projectPath)) continue

      const dir = path.dirname(filePath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(filePath, content, 'utf-8')

      db.prepare(`
        INSERT INTO ai_config_project_selections (id, project_id, item_id, provider, target_path, content_hash, selected_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(project_id, item_id, provider) DO UPDATE SET
          target_path = excluded.target_path, content_hash = excluded.content_hash, selected_at = datetime('now')
      `).run(crypto.randomUUID(), projectId, itemId, provider, rootPath, hash)

      providerStatus[provider] = 'synced'
    }

    const result: RootInstructionsResult = { content, providerStatus }
    return result
  })

  ipcMain.handle('ai-config:get-project-skills-status', (_event, projectId: string, projectPath: string) => {
    const providers = getEnabledProviders(projectId)
    const resolvedProject = path.resolve(projectPath)

    const selections = db.prepare(`
      SELECT ps.*, i.content as item_content, i.type as item_type, i.slug as item_slug,
             i.name as item_name, i.scope as item_scope, i.metadata_json as item_metadata,
             i.created_at as item_created, i.updated_at as item_updated
      FROM ai_config_project_selections ps
      JOIN ai_config_items i ON i.id = ps.item_id
      WHERE ps.project_id = ? AND i.type IN ('skill', 'command')
    `).all(projectId) as Array<AiConfigProjectSelection & {
      item_content: string; item_type: string; item_slug: string
      item_name: string; item_scope: string; item_metadata: string
      item_created: string; item_updated: string
    }>

    // Group by item_id
    const byItem = new Map<string, typeof selections>()
    for (const sel of selections) {
      const list = byItem.get(sel.item_id) ?? []
      list.push(sel)
      byItem.set(sel.item_id, list)
    }

    const results: ProjectSkillStatus[] = []
    for (const [, sels] of byItem) {
      const first = sels[0]
      const item: AiConfigItem = {
        id: first.item_id,
        type: first.item_type as AiConfigItem['type'],
        scope: first.item_scope as AiConfigItem['scope'],
        project_id: first.project_id,
        name: first.item_name,
        slug: first.item_slug,
        content: first.item_content,
        metadata_json: first.item_metadata,
        created_at: first.item_created,
        updated_at: first.item_updated
      }

      const providerMap: ProjectSkillStatus['providers'] = {}
      for (const provider of providers) {
        const sel = sels.find(s => s.provider === provider)
        if (sel) {
          const filePath = path.isAbsolute(sel.target_path)
            ? sel.target_path
            : path.join(resolvedProject, sel.target_path)
          let status: ProviderSyncStatus = 'not_synced'
          if (fs.existsSync(filePath)) {
            const diskHash = contentHash(fs.readFileSync(filePath, 'utf-8'))
            const itemHash = contentHash(first.item_content)
            status = diskHash === itemHash ? 'synced' : 'out_of_sync'
          }
          providerMap[provider] = { path: sel.target_path, status }
        } else {
          // No selection for this provider yet
          providerMap[provider] = { path: '', status: 'not_synced' }
        }
      }

      results.push({ item, providers: providerMap })
    }

    return results
  })

  // --- Provider management ---

  ipcMain.handle('ai-config:list-providers', () => {
    return db.prepare('SELECT * FROM ai_config_sources ORDER BY name').all() as CliProviderInfo[]
  })

  ipcMain.handle('ai-config:toggle-provider', (_event, id: string, enabled: boolean) => {
    db.prepare('UPDATE ai_config_sources SET enabled = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(enabled ? 1 : 0, id)
  })

  ipcMain.handle('ai-config:get-project-providers', (_event, projectId: string) => {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?')
      .get(`ai_providers:${projectId}`) as { value: string } | undefined
    if (row) return JSON.parse(row.value) as CliProvider[]
    // Fallback: all globally enabled active providers
    const providers = db.prepare('SELECT kind FROM ai_config_sources WHERE enabled = 1 AND status = ?')
      .all('active') as Array<{ kind: string }>
    return providers.map(p => p.kind as CliProvider)
  })

  ipcMain.handle('ai-config:set-project-providers', (_event, projectId: string, providers: CliProvider[]) => {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(`ai_providers:${projectId}`, JSON.stringify(providers))
  })

  ipcMain.handle('ai-config:needs-sync', (_event, projectId: string, projectPath: string): boolean => {
    const providers = getEnabledProviders(projectId)
    if (providers.length === 0) return false
    const resolvedProject = path.resolve(projectPath)

    // Check root instructions
    const rootItem = db.prepare(
      "SELECT content FROM ai_config_items WHERE type = 'root_instructions' AND scope = 'project' AND project_id = ?"
    ).get(projectId) as { content: string } | undefined
    if (rootItem) {
      const hash = contentHash(rootItem.content)
      for (const provider of providers) {
        const rootPath = PROVIDER_PATHS[provider]?.rootInstructions
        if (!rootPath) continue
        const filePath = path.join(resolvedProject, rootPath)
        if (!fs.existsSync(filePath)) return true
        if (contentHash(fs.readFileSync(filePath, 'utf-8')) !== hash) return true
      }
    }

    // Check skills/commands
    const selections = db.prepare(`
      SELECT ps.provider, ps.target_path, ps.content_hash, i.content as item_content
      FROM ai_config_project_selections ps
      JOIN ai_config_items i ON i.id = ps.item_id
      WHERE ps.project_id = ? AND i.type IN ('skill', 'command')
    `).all(projectId) as Array<{ provider: string; target_path: string; content_hash: string | null; item_content: string }>

    for (const sel of selections) {
      const filePath = path.isAbsolute(sel.target_path)
        ? sel.target_path
        : path.join(resolvedProject, sel.target_path)
      if (!fs.existsSync(filePath)) return true
      const diskHash = contentHash(fs.readFileSync(filePath, 'utf-8'))
      const itemHash = contentHash(sel.item_content)
      if (diskHash !== itemHash) return true
    }

    return false
  })

  ipcMain.handle('ai-config:sync-all', (_event, input: SyncAllInput) => {
    const resolvedProject = path.resolve(input.projectPath)

    // Get enabled providers for this project
    let providers = input.providers
    if (!providers) {
      const row = db.prepare('SELECT value FROM settings WHERE key = ?')
        .get(`ai_providers:${input.projectId}`) as { value: string } | undefined
      if (row) {
        providers = JSON.parse(row.value) as CliProvider[]
      } else {
        const active = db.prepare('SELECT kind FROM ai_config_sources WHERE enabled = 1 AND status = ?')
          .all('active') as Array<{ kind: string }>
        providers = active.map(p => p.kind as CliProvider)
      }
    }

    const result: SyncResult = { written: [], conflicts: [] }

    // Get all selections for this project with item content
    const selections = db.prepare(`
      SELECT ps.*, i.content as item_content, i.type as item_type, i.slug as item_slug
      FROM ai_config_project_selections ps
      JOIN ai_config_items i ON i.id = ps.item_id
      WHERE ps.project_id = ?
    `).all(input.projectId) as Array<AiConfigProjectSelection & { item_content: string; item_type: string; item_slug: string }>

    // Group by item_id to find which providers already have selections
    const byItem = new Map<string, typeof selections>()
    for (const sel of selections) {
      const list = byItem.get(sel.item_id) ?? []
      list.push(sel)
      byItem.set(sel.item_id, list)
    }

    for (const [itemId, sels] of byItem) {
      const first = sels[0]
      const hash = contentHash(first.item_content)

      for (const provider of providers) {
        // Compute expected path for this provider
        const relativePath = first.item_type === 'skill'
          ? getSkillPath(provider, first.item_slug)
          : first.item_type === 'command'
            ? getCommandPath(provider, first.item_slug)
            : PROVIDER_PATHS[provider]?.rootInstructions
        if (!relativePath) continue

        const filePath = path.join(resolvedProject, relativePath)
        if (!isPathAllowed(filePath, input.projectPath)) continue

        // Check for external edits via content hash
        const existingSel = sels.find(s => s.provider === provider)
        if (fs.existsSync(filePath) && existingSel?.content_hash) {
          const diskHash = contentHash(fs.readFileSync(filePath, 'utf-8'))
          if (diskHash !== existingSel.content_hash && diskHash !== hash) {
            result.conflicts.push({ path: relativePath, provider, itemId, reason: 'external_edit' })
            continue
          }
        }

        // Write file
        const dir = path.dirname(filePath)
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
        fs.writeFileSync(filePath, first.item_content, 'utf-8')

        // Upsert selection
        db.prepare(`
          INSERT INTO ai_config_project_selections (id, project_id, item_id, provider, target_path, content_hash, selected_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(project_id, item_id, provider) DO UPDATE SET
            target_path = excluded.target_path, content_hash = excluded.content_hash, selected_at = datetime('now')
        `).run(crypto.randomUUID(), input.projectId, itemId, provider, relativePath, hash)

        result.written.push({ path: relativePath, provider })
      }
    }

    return result
  })

  ipcMain.handle('ai-config:check-sync-status', (_event, projectId: string, projectPath: string) => {
    const resolvedProject = path.resolve(projectPath)
    const conflicts: SyncConflict[] = []

    const selections = db.prepare(`
      SELECT ps.*, i.content as item_content
      FROM ai_config_project_selections ps
      JOIN ai_config_items i ON i.id = ps.item_id
      WHERE ps.project_id = ?
    `).all(projectId) as Array<AiConfigProjectSelection & { item_content: string }>

    for (const sel of selections) {
      const filePath = path.isAbsolute(sel.target_path)
        ? sel.target_path
        : path.join(resolvedProject, sel.target_path)

      if (!fs.existsSync(filePath)) continue
      const diskHash = contentHash(fs.readFileSync(filePath, 'utf-8'))
      const expectedHash = contentHash(sel.item_content)
      if (sel.content_hash && diskHash !== sel.content_hash && diskHash !== expectedHash) {
        conflicts.push({
          path: sel.target_path,
          provider: sel.provider as CliProvider,
          itemId: sel.item_id,
          reason: 'external_edit'
        })
      }
    }

    return conflicts
  })

  // MCP config discovery + management
  const MCP_CONFIG_PATHS: Record<McpProvider, { relativePath: string; serversKey: string }> = {
    claude: { relativePath: '.mcp.json', serversKey: 'mcpServers' },
    cursor: { relativePath: '.cursor/mcp.json', serversKey: 'mcpServers' },
    vscode: { relativePath: '.vscode/mcp.json', serversKey: 'servers' }
  }

  ipcMain.handle('ai-config:discover-mcp-configs', (_event, projectPath: string): McpConfigFileResult[] => {
    const resolvedProject = path.resolve(projectPath)
    const results: McpConfigFileResult[] = []
    for (const [provider, spec] of Object.entries(MCP_CONFIG_PATHS)) {
      const filePath = path.join(resolvedProject, spec.relativePath)
      const exists = fs.existsSync(filePath)
      let servers: Record<string, McpServerConfig> = {}
      if (exists) {
        try {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
          const raw = data[spec.serversKey]
          if (raw && typeof raw === 'object') {
            servers = raw as Record<string, McpServerConfig>
          }
        } catch { /* ignore parse errors */ }
      }
      results.push({ provider: provider as McpProvider, exists, servers })
    }
    return results
  })

  ipcMain.handle('ai-config:write-mcp-server', (_event, input: WriteMcpServerInput) => {
    const spec = MCP_CONFIG_PATHS[input.provider]
    const resolvedProject = path.resolve(input.projectPath)
    const filePath = path.join(resolvedProject, spec.relativePath)

    let data: Record<string, unknown> = {}
    if (fs.existsSync(filePath)) {
      try { data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) } catch { /* start fresh */ }
    }

    const servers = (data[spec.serversKey] ?? {}) as Record<string, McpServerConfig>
    const config = { ...input.config }
    if (input.provider === 'vscode' && !config.type) config.type = 'stdio'
    servers[input.serverKey] = config
    data[spec.serversKey] = servers

    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
  })

  ipcMain.handle('ai-config:remove-mcp-server', (_event, input: RemoveMcpServerInput) => {
    const spec = MCP_CONFIG_PATHS[input.provider]
    const resolvedProject = path.resolve(input.projectPath)
    const filePath = path.join(resolvedProject, spec.relativePath)

    if (!fs.existsSync(filePath)) return

    let data: Record<string, unknown> = {}
    try { data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) } catch { return }

    const servers = (data[spec.serversKey] ?? {}) as Record<string, McpServerConfig>
    delete servers[input.serverKey]
    data[spec.serversKey] = servers

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
  })
}
