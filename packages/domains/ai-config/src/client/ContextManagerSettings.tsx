import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft, Check, AlertCircle, ChevronRight,
  Plus, Sparkles, Wrench, Server, FileText, FolderTree, RefreshCw, Settings2
} from 'lucide-react'
import { Button, cn, FileTree, fileTreeIndent, Switch } from '@slayzone/ui'
import type {
  AiConfigItem, AiConfigItemType, AiConfigScope,
  CliProvider, CliProviderInfo, ContextTreeEntry, ProjectSkillStatus,
  ProviderSyncStatus, UpdateAiConfigItemInput
} from '../shared'
import { ContextItemEditor } from './ContextItemEditor'
import { GlobalContextFiles } from './GlobalContextFiles'
import { McpServersPanel } from './McpServersPanel'
import { ProjectContextTree } from './ProjectContextTree'
import { ProjectInstructions } from './ProjectInstructions'
import { ProjectSkills } from './ProjectSkills'
import { ProviderChips } from './ProviderChips'

type GlobalSection = 'providers' | 'instructions' | 'skill' | 'command' | 'mcp' | 'files'
type ProjectSection = 'providers' | 'instructions' | 'skills' | 'commands' | 'files' | 'mcp'
type Section = GlobalSection | ProjectSection

interface ContextManagerSettingsProps {
  scope: AiConfigScope
  projectId: string | null
  projectPath?: string | null
  projectName?: string
}

function formatTimestamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Recently'
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// ---------------------------------------------------------------------------
// Sync status badge
// ---------------------------------------------------------------------------

function SyncBadge({ status, label }: { status: ProviderSyncStatus; label: string }) {
  const synced = status === 'synced'
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium',
      synced
        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
        : status === 'out_of_sync'
          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
          : 'bg-muted text-muted-foreground'
    )}>
      {synced ? <Check className="size-2.5" /> : <AlertCircle className="size-2.5" />}
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Overview panel — loads live data and renders clickable cards
// ---------------------------------------------------------------------------

interface OverviewData {
  instructions: { content: string; providerStatus: Partial<Record<CliProvider, ProviderSyncStatus>> } | null
  skills: AiConfigItem[] | ProjectSkillStatus[]
  commands: AiConfigItem[] | ProjectSkillStatus[]
  providers: CliProviderInfo[]
  enabledProviders: CliProvider[]
  mcpCount: number
}

function OverviewPanel({
  scope,
  isProject,
  projectId,
  projectPath,
  onNavigate,
  version
}: {
  scope: AiConfigScope
  isProject: boolean
  projectId: string | null
  projectPath: string | null | undefined
  onNavigate: (section: Section) => void
  version: number
}) {
  const [data, setData] = useState<OverviewData | null>(null)

  useEffect(() => {
    let stale = false
    void (async () => {
      try {
        if (isProject && projectId && projectPath) {
          const [instrResult, skillsResult, commandsResult, providers, enabledProviders, mcpConfigs] = await Promise.all([
            window.api.aiConfig.getRootInstructions(projectId, projectPath),
            window.api.aiConfig.getProjectSkillsStatus(projectId, projectPath),
            window.api.aiConfig.listItems({ scope: 'project', projectId, type: 'command' }),
            window.api.aiConfig.listProviders(),
            window.api.aiConfig.getProjectProviders(projectId),
            window.api.aiConfig.discoverMcpConfigs(projectPath)
          ])
          if (stale) return
          const mcpCount = mcpConfigs.reduce((sum, c) => sum + Object.keys(c.servers).length, 0)
          setData({
            instructions: instrResult,
            skills: skillsResult,
            commands: commandsResult,
            providers,
            enabledProviders,
            mcpCount
          })
        } else {
          const [instrContent, skills, commands, providers] = await Promise.all([
            window.api.aiConfig.getGlobalInstructions(),
            window.api.aiConfig.listItems({ scope: 'global', type: 'skill' }),
            window.api.aiConfig.listItems({ scope: 'global', type: 'command' }),
            window.api.aiConfig.listProviders()
          ])
          if (stale) return
          setData({
            instructions: { content: instrContent, providerStatus: {} },
            skills,
            commands,
            providers,
            enabledProviders: providers.filter(p => p.enabled).map(p => p.id as CliProvider),
            mcpCount: 0
          })
        }
      } catch {
        // silently fail — cards will show loading state
      }
    })()
    return () => { stale = true }
  }, [isProject, projectId, projectPath, scope, version])

  if (!data) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-20 animate-pulse rounded-lg border bg-muted/20" />
        ))}
      </div>
    )
  }

  const skillCount = data.skills.length
  const commandCount = data.commands.length
  const enabledProviders = data.providers.filter(p => p.enabled)
  const hasContent = !!data.instructions?.content

  // Compute aggregate sync status for project skills
  const skillSyncSummary: Partial<Record<CliProvider, { synced: number; total: number }>> = {}
  if (isProject && data.skills.length > 0 && 'providers' in (data.skills[0] ?? {})) {
    for (const s of data.skills as ProjectSkillStatus[]) {
      for (const [prov, info] of Object.entries(s.providers)) {
        const key = prov as CliProvider
        if (!skillSyncSummary[key]) skillSyncSummary[key] = { synced: 0, total: 0 }
        skillSyncSummary[key]!.total++
        if (info?.status === 'synced') skillSyncSummary[key]!.synced++
      }
    }
  }

  return (
    <div className="space-y-2.5">
      {/* Providers — at top */}
      <button
        onClick={() => onNavigate('providers')}
        className="flex w-full items-center gap-3 rounded-lg border p-3.5 text-left transition-colors hover:bg-muted/50"
      >
        <Settings2 className="size-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Providers</span>
            <div className="flex items-center gap-2">
              {enabledProviders.map(p => (
                <span key={p.id} className="flex items-center gap-1 text-xs text-muted-foreground">
                  <div className="size-2 rounded-full bg-green-500" />
                  {p.name}
                </span>
              ))}
            </div>
          </div>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {/* Instructions */}
      <button
        onClick={() => onNavigate('instructions')}
        className="flex w-full items-center gap-3 rounded-lg border p-3.5 text-left transition-colors hover:bg-muted/50"
      >
        <FileText className="size-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Instructions</span>
            {isProject && data.instructions?.providerStatus && (
              <div className="flex gap-1">
                {Object.entries(data.instructions.providerStatus).map(([prov, status]) => (
                  <SyncBadge key={prov} status={status} label={prov === 'claude' ? 'CLAUDE.md' : 'AGENTS.md'} />
                ))}
              </div>
            )}
            {!isProject && hasContent && (
              <span className="inline-flex items-center gap-1 rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                <Check className="size-2.5" /> Saved
              </span>
            )}
          </div>
          {hasContent && (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
              {data.instructions!.content.slice(0, 120)}
            </p>
          )}
          {!hasContent && (
            <p className="mt-0.5 text-xs text-muted-foreground">No instructions yet</p>
          )}
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {/* Skills */}
      <button
        onClick={() => onNavigate(isProject ? 'skills' : 'skill')}
        className="flex w-full items-center gap-3 rounded-lg border p-3.5 text-left transition-colors hover:bg-muted/50"
      >
        <Sparkles className="size-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Skills</span>
            <span className="text-xs text-muted-foreground">{skillCount} defined</span>
            {isProject && Object.entries(skillSyncSummary).map(([prov, info]) => (
              <SyncBadge
                key={prov}
                status={info.synced === info.total ? 'synced' : 'out_of_sync'}
                label={`${prov} ${info.synced}/${info.total}`}
              />
            ))}
          </div>
          {skillCount > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {(data.skills as Array<AiConfigItem | ProjectSkillStatus>).slice(0, 5).map((s, i) => {
                const slug = 'slug' in s ? s.slug : s.item.slug
                return <span key={i} className="rounded border bg-muted/30 px-1.5 py-0.5 font-mono text-[11px]">{slug}</span>
              })}
              {skillCount > 5 && <span className="text-[11px] text-muted-foreground">+{skillCount - 5} more</span>}
            </div>
          )}
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {/* Commands */}
      <button
        onClick={() => onNavigate(isProject ? 'commands' : 'command')}
        className="flex w-full items-center gap-3 rounded-lg border p-3.5 text-left transition-colors hover:bg-muted/50"
      >
        <Wrench className="size-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Commands</span>
            <span className="text-xs text-muted-foreground">{commandCount} defined</span>
          </div>
          {commandCount > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {(data.commands as AiConfigItem[]).slice(0, 5).map((s, i) => (
                <span key={i} className="rounded border bg-muted/30 px-1.5 py-0.5 font-mono text-[11px]">{s.slug}</span>
              ))}
            </div>
          )}
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {/* MCP Servers */}
      <button
        onClick={() => onNavigate('mcp')}
        className="flex w-full items-center gap-3 rounded-lg border p-3.5 text-left transition-colors hover:bg-muted/50"
      >
        <Server className="size-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">MCP Servers</span>
            {isProject && data.mcpCount > 0 && (
              <span className="text-xs text-muted-foreground">{data.mcpCount} configured</span>
            )}
          </div>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {/* Files — only for global scope (project has the side panel) */}
      {!isProject && (
        <button
          onClick={() => onNavigate('files')}
          className="flex w-full items-center gap-3 rounded-lg border p-3.5 text-left transition-colors hover:bg-muted/50"
        >
          <FolderTree className="size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <span className="text-sm font-medium">Files</span>
            <p className="mt-0.5 text-xs text-muted-foreground">Global config files across all providers</p>
          </div>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Providers panel (global)
// ---------------------------------------------------------------------------

function ProvidersPanel() {
  const [providers, setProviders] = useState<CliProviderInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        const list = await window.api.aiConfig.listProviders()
        setProviders(list)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const handleToggle = async (provider: CliProviderInfo) => {
    const newEnabled = !provider.enabled
    await window.api.aiConfig.toggleProvider(provider.id, newEnabled)
    setProviders(prev => prev.map(p => p.id === provider.id ? { ...p, enabled: newEnabled } : p))
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading...</p>

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Enable the CLI tools you use. Skills and instructions will sync to enabled providers.
      </p>
      {providers.map(provider => {
        const isPlaceholder = provider.status === 'placeholder'
        return (
          <div
            key={provider.id}
            className={cn(
              'flex items-center justify-between rounded-md border px-3 py-2.5',
              isPlaceholder && 'opacity-50'
            )}
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">{provider.name}</p>
              {isPlaceholder && (
                <p className="text-[11px] text-muted-foreground">Coming soon</p>
              )}
            </div>
            <Switch
              checked={provider.enabled}
              onCheckedChange={() => handleToggle(provider)}
              disabled={isPlaceholder}
            />
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Synced files panel — shows file tree on disk with per-file sync
// ---------------------------------------------------------------------------

function SyncedFileRow({
  entry,
  name,
  depth,
  onSync,
}: {
  entry: ContextTreeEntry
  name: string
  depth: number
  onSync: () => void
}) {
  return (
    <div
      className="group flex items-center gap-1.5 rounded px-1 py-1 text-xs hover:bg-muted/50"
      style={{ paddingLeft: fileTreeIndent(depth) }}
    >
      <span className="flex-1 truncate font-mono">{name}</span>
      {entry.syncStatus === 'synced' && (
        <Check className="size-3 text-green-600 dark:text-green-400 shrink-0" />
      )}
      {entry.syncStatus === 'out_of_sync' && (
        <AlertCircle className="size-3 text-amber-600 dark:text-amber-400 shrink-0" />
      )}
      {entry.linkedItemId && (
        <button
          type="button"
          onClick={onSync}
          className="text-muted-foreground hover:text-foreground transition-colors p-0.5 opacity-0 group-hover:opacity-100"
          title={`Sync ${name}`}
        >
          <RefreshCw className="size-3" />
        </button>
      )}
    </div>
  )
}

function SyncedFilesPanel({
  projectId,
  projectPath,
  version,
  onSynced,
}: {
  projectId: string
  projectPath: string
  version: number
  onSynced: () => void
}) {
  const [entries, setEntries] = useState<ContextTreeEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [syncingAll, setSyncingAll] = useState(false)

  useEffect(() => {
    let stale = false
    setLoading(true)
    void (async () => {
      try {
        const tree = await window.api.aiConfig.getContextTree(projectPath, projectId)
        if (stale) return
        setEntries(tree)
      } finally {
        if (!stale) setLoading(false)
      }
    })()
    return () => { stale = true }
  }, [projectId, projectPath, version])

  const handleSyncFile = async (entry: ContextTreeEntry) => {
    if (!entry.linkedItemId) return
    try {
      const updated = await window.api.aiConfig.syncLinkedFile(projectId, projectPath, entry.linkedItemId)
      setEntries((prev) => prev.map((e) => (e.path === updated.path ? updated : e)))
      onSynced()
    } catch {
      // silently fail
    }
  }

  const handleSyncAll = async () => {
    setSyncingAll(true)
    try {
      await window.api.aiConfig.syncAll({ projectId, projectPath })
      const tree = await window.api.aiConfig.getContextTree(projectPath, projectId)
      setEntries(tree)
      onSynced()
    } finally {
      setSyncingAll(false)
    }
  }

  const getPath = useCallback((e: ContextTreeEntry) => e.relativePath, [])
  const projectEntries = useMemo(() => entries.filter((e) => !e.relativePath.startsWith('~')), [entries])
  const globalEntries = useMemo(() => entries.filter((e) => e.relativePath.startsWith('~')), [entries])

  const renderFile = useCallback((entry: ContextTreeEntry, info: { name: string; depth: number }) => (
    <SyncedFileRow
      entry={entry}
      name={info.name}
      depth={info.depth}
      onSync={() => handleSyncFile(entry)}
    />
  ), [])

  if (loading && entries.length === 0) {
    return (
      <div className="space-y-1">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-5 animate-pulse rounded bg-muted/20" />
        ))}
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-muted-foreground">Synced Files</span>
        <button
          type="button"
          onClick={handleSyncAll}
          disabled={syncingAll}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('size-3', syncingAll && 'animate-spin')} />
          Sync All
        </button>
      </div>

      <div className="overflow-y-auto space-y-3" style={{ maxHeight: 'calc(100vh - 340px)' }}>
        {projectEntries.length > 0 && (
          <div>
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Project</span>
            <FileTree
              items={projectEntries}
              getPath={getPath}
              renderFile={renderFile}
              defaultExpanded
            />
          </div>
        )}

        {globalEntries.length > 0 && (
          <div>
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Global</span>
            <FileTree
              items={globalEntries}
              getPath={getPath}
              renderFile={renderFile}
              defaultExpanded
            />
          </div>
        )}

        {entries.length === 0 && !loading && (
          <p className="text-xs text-muted-foreground py-4 text-center">
            No synced files yet. Hit Sync to write files to disk.
          </p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ContextManagerSettings({ scope, projectId, projectPath, projectName }: ContextManagerSettingsProps) {
  const [section, setSection] = useState<Section | null>(null)
  const [items, setItems] = useState<AiConfigItem[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [providerVersion, setProviderVersion] = useState(0)
  const [syncCheckVersion, setSyncCheckVersion] = useState(0)
  const [pickerTrigger, setPickerTrigger] = useState(0)
  const [createTrigger, setCreateTrigger] = useState(0)

  const isProject = scope === 'project' && !!projectId && !!projectPath

  const handleChildChanged = () => setSyncCheckVersion(v => v + 1)

  const isItemSection = section === 'skill' || section === 'command'

  const loadItems = useCallback(async () => {
    if (!isItemSection) return
    setLoading(true)
    try {
      const rows = await window.api.aiConfig.listItems({
        scope: 'global',
        type: section as AiConfigItemType
      })
      setItems(rows)
    } finally {
      setLoading(false)
    }
  }, [section, isItemSection])

  useEffect(() => {
    void loadItems()
    setEditingId(null)
  }, [loadItems])

  const handleCreate = async () => {
    if (!isItemSection) return
    const type = section as AiConfigItemType
    const defaultContent = type === 'skill'
      ? '---\ndescription: \ntrigger: auto\n---\n\n'
      : '---\ndescription: \nshortcut: \n---\n\n'
    const created = await window.api.aiConfig.createItem({
      type,
      scope: 'global',
      slug: type === 'skill' ? 'new-skill' : 'new-command',
      content: defaultContent
    })
    setItems((prev) => [created, ...prev])
    setEditingId(created.id)
  }

  const handleUpdate = async (itemId: string, patch: Omit<UpdateAiConfigItemInput, 'id'>) => {
    const updated = await window.api.aiConfig.updateItem({ id: itemId, ...patch })
    if (!updated) return
    setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
  }

  const handleDelete = async (itemId: string) => {
    await window.api.aiConfig.deleteItem(itemId)
    setItems((prev) => prev.filter((item) => item.id !== itemId))
    setEditingId(null)
  }

  const mainContent = (
    <div className={cn(isProject ? 'flex-1 min-w-0' : 'flex min-h-full flex-col')}>
      {/* Header: back button + actions when drilled in */}
      {section !== null && (
        <div className="flex items-center justify-between gap-3 pb-4">
          <button
            onClick={() => setSection(null)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Overview
          </button>

          <div className="flex items-center gap-2">
            {isItemSection && (
              <Button size="sm" onClick={handleCreate}>
                <Plus className="mr-1 size-3.5" />
                New
              </Button>
            )}
            {(section === 'skills' || section === 'commands') && scope === 'project' && (
              <>
                <Button size="sm" onClick={() => setCreateTrigger(v => v + 1)}>
                  <Plus className="mr-1 size-3.5" />
                  New
                </Button>
                <Button size="sm" variant="outline" onClick={() => setPickerTrigger(v => v + 1)}>
                  <Plus className="mr-1 size-3.5" />
                  Add from Global
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Section description */}
      {section !== null && (
        <p className="pb-3 text-xs text-muted-foreground">
          {section === 'providers' && 'Choose which AI coding tools to sync content to.'}
          {section === 'instructions' && (isProject
            ? 'Project-level instructions synced to each provider\'s config file (e.g. CLAUDE.md).'
            : 'Global instructions stored in the database. Not synced to any file.'
          )}
          {(section === 'skill' || section === 'skills') && (isProject
            ? 'Reusable prompt snippets available to AI assistants in this project.'
            : 'Global skills shared across all projects. Synced to enabled providers.'
          )}
          {(section === 'command' || section === 'commands') && (isProject
            ? 'Slash commands available to AI assistants in this project.'
            : 'Global commands shared across all projects. Invoked via /command-name.'
          )}
          {section === 'mcp' && (isProject
            ? 'MCP servers configured for this project, written to each provider\'s config.'
            : 'Browse and favorite MCP servers from the curated catalog.'
          )}
          {section === 'files' && (isProject
            ? 'Raw config files on disk. Managed automatically when you sync.'
            : 'Global config files across all provider directories.'
          )}
        </p>
      )}

      {/* Content area */}
      <div className="flex-1">
        {section === null ? (
          <OverviewPanel
            scope={scope}
            isProject={isProject}
            projectId={projectId}
            projectPath={projectPath}
            onNavigate={setSection}
            version={providerVersion + syncCheckVersion}
          />
        ) : section === 'providers' ? (
          scope === 'project' && projectId ? (
            <ProviderChips projectId={projectId} onChange={() => setProviderVersion(v => v + 1)} />
          ) : (
            <ProvidersPanel />
          )
        ) : section === 'instructions' && scope === 'project' && projectPath && projectId ? (
          <ProjectInstructions key={providerVersion} projectId={projectId} projectPath={projectPath} onChanged={handleChildChanged} />
        ) : section === 'instructions' && scope === 'global' ? (
          <ProjectInstructions />
        ) : section === 'skills' && scope === 'project' && projectPath && projectId ? (
          <ProjectSkills key={providerVersion} projectId={projectId} projectPath={projectPath} type="skill" openPickerTrigger={pickerTrigger} openCreateTrigger={createTrigger} onChanged={handleChildChanged} />
        ) : section === 'commands' && scope === 'project' && projectPath && projectId ? (
          <ProjectSkills key={`cmd-${providerVersion}`} projectId={projectId} projectPath={projectPath} type="command" openPickerTrigger={pickerTrigger} openCreateTrigger={createTrigger} onChanged={handleChildChanged} />
        ) : section === 'mcp' ? (
          <McpServersPanel
            mode={scope === 'project' ? 'project' : 'global'}
            projectPath={projectPath ?? undefined}
            projectId={projectId ?? undefined}
          />
        ) : section === 'files' && scope === 'global' ? (
          <GlobalContextFiles />
        ) : section === 'files' && scope === 'project' && projectPath && projectId ? (
          <ProjectContextTree
            projectPath={projectPath}
            projectId={projectId}
            projectName={projectName}
          />
        ) : isItemSection ? (
          <>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
                {section === 'skill'
                  ? <Sparkles className="size-8 text-muted-foreground/40" />
                  : <Wrench className="size-8 text-muted-foreground/40" />
                }
                <p className="mt-3 text-sm font-medium text-foreground">
                  No {section === 'skill' ? 'skills' : 'commands'} yet
                </p>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                  {section === 'skill'
                    ? 'Skills give AI assistants reusable capabilities. Create one to get started.'
                    : 'Commands are shortcuts you can invoke from any provider. Create one to get started.'}
                </p>
                <Button size="sm" className="mt-4" onClick={handleCreate}>
                  <Plus className="mr-1 size-3.5" />
                  Create {section === 'skill' ? 'skill' : 'command'}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.id}>
                    {editingId === item.id ? (
                      <ContextItemEditor
                        item={item}
                        onUpdate={(patch) => handleUpdate(item.id, patch)}
                        onDelete={() => handleDelete(item.id)}
                        onClose={() => setEditingId(null)}
                      />
                    ) : (
                      <button
                        onClick={() => setEditingId(item.id)}
                        className="flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-mono text-sm">{item.slug}</p>
                        </div>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {formatTimestamp(item.updated_at)}
                        </span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  )

  // Project mode: horizontal split with file tree on the right
  if (isProject) {
    return (
      <div className="flex min-h-full gap-4">
        {mainContent}
        <div className="w-64 shrink-0 border-l pl-4">
          <SyncedFilesPanel
            projectId={projectId!}
            projectPath={projectPath!}
            version={providerVersion + syncCheckVersion}
            onSynced={() => setSyncCheckVersion(v => v + 1)}
          />
        </div>
      </div>
    )
  }

  return mainContent
}
