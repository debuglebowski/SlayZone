import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft, ChevronRight,
  Plus, Sparkles, Server, FileText, FolderTree, Settings2,
  type LucideIcon
} from 'lucide-react'
import { Button, cn, Switch } from '@slayzone/ui'
import type {
  AiConfigItem, AiConfigScope, CliProvider,
  CliProviderInfo, UpdateAiConfigItemInput
} from '../shared'
import { PROVIDER_LABELS } from '../shared/provider-registry'
import { ContextItemEditor } from './ContextItemEditor'
import { GlobalContextFiles } from './GlobalContextFiles'
import { McpServersPanel } from './McpServersPanel'
import { ProjectContextFlat } from './ProjectContextFlat'
import { ProjectContextFilesView } from './ProjectContextFilesView'
import { ProjectInstructions } from './ProjectInstructions'

type Section = 'providers' | 'instructions' | 'skill' | 'mcp' | 'files'

interface ContextManagerSettingsProps {
  scope: AiConfigScope
  projectId: string | null
  projectPath?: string | null
  projectName?: string
  projectTab?: ProjectContextManagerTab
}

export type ProjectContextManagerTab = 'config' | 'files'

function formatTimestamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Recently'
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function nextAvailableSlug(base: string, existingSlugs: Set<string>): string {
  if (!existingSlugs.has(base)) return base
  let index = 2
  while (existingSlugs.has(`${base}-${index}`)) index += 1
  return `${base}-${index}`
}

// ---------------------------------------------------------------------------
// Shared overview card
// ---------------------------------------------------------------------------

function OverviewCard({ testId, icon: Icon, label, detail, onClick }: {
  testId: string
  icon: LucideIcon
  label: string
  detail?: string
  onClick: () => void
}) {
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg border p-3.5 text-left transition-colors hover:bg-muted/50"
    >
      <Icon className="size-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <span className="text-sm font-medium">{label}</span>
      </div>
      {detail && <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">{detail}</span>}
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </button>
  )
}

// ---------------------------------------------------------------------------
// Overview panel — global scope only
// ---------------------------------------------------------------------------

interface OverviewData {
  instructions: { content: string } | null
  skills: AiConfigItem[]
  providers: CliProviderInfo[]
}

function OverviewPanel({
  onNavigate,
  version
}: {
  onNavigate: (section: Section) => void
  version: number
}) {
  const [data, setData] = useState<OverviewData | null>(null)

  useEffect(() => {
    let stale = false
    void (async () => {
      try {
        const [instrContent, skills, providers] = await Promise.all([
          window.api.aiConfig.getGlobalInstructions(),
          window.api.aiConfig.listItems({ scope: 'global', type: 'skill' }),
          window.api.aiConfig.listProviders()
        ])
        if (stale) return
        setData({
          instructions: { content: instrContent },
          skills,
          providers,
        })
      } catch {
        // silently fail — cards will show loading state
      }
    })()
    return () => { stale = true }
  }, [version])

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
  const enabledProviders = data.providers.filter(p => p.enabled)
  const hasContent = !!data.instructions?.content

  return (
    <div className="space-y-2.5">
      <OverviewCard testId="context-overview-providers" icon={Settings2} label="Providers" detail={`${enabledProviders.length} enabled`} onClick={() => onNavigate('providers')} />
      <OverviewCard testId="context-overview-instructions" icon={FileText} label="Instructions" detail={hasContent ? 'Saved' : 'Empty'} onClick={() => onNavigate('instructions')} />
      <OverviewCard testId="context-overview-skills" icon={Sparkles} label="Skills" detail={`${skillCount} defined`} onClick={() => onNavigate('skill')} />
      <OverviewCard testId="context-overview-mcp" icon={Server} label="MCP Servers" onClick={() => onNavigate('mcp')} />
      <OverviewCard testId="context-overview-files" icon={FolderTree} label="Files" onClick={() => onNavigate('files')} />
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
        Enable the providers you use. Skills and instructions will sync to enabled providers.
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
              <p className="text-sm font-medium">
                {PROVIDER_LABELS[provider.kind as CliProvider] ?? provider.name}
              </p>
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
// Main component
// ---------------------------------------------------------------------------

export function ContextManagerSettings({ scope, projectId, projectPath, projectName, projectTab }: ContextManagerSettingsProps) {
  const isProject = scope === 'project' && !!projectId && !!projectPath
  const activeProjectTab = projectTab ?? 'config'

  if (isProject) {
    if (activeProjectTab === 'files') {
      return (
        <ProjectContextFilesView
          projectId={projectId!}
          projectPath={projectPath!}
        />
      )
    }

    return (
      <ProjectContextFlat
        projectId={projectId!}
        projectPath={projectPath!}
        projectName={projectName}
      />
    )
  }

  return <GlobalContextManager />
}

// ---------------------------------------------------------------------------
// Global context manager — own component so hooks are unconditional
// ---------------------------------------------------------------------------

function GlobalContextManager() {
  const [section, setSection] = useState<Section | null>(null)
  const [items, setItems] = useState<AiConfigItem[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [providerVersion] = useState(0)
  const [syncCheckVersion] = useState(0)

  const isItemSection = section === 'skill'

  const loadItems = useCallback(async () => {
    if (!isItemSection) return
    setLoading(true)
    try {
      const rows = await window.api.aiConfig.listItems({
        scope: 'global',
        type: 'skill'
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
    const existingSlugs = new Set(items.map((item) => item.slug))
    const slug = nextAvailableSlug('new-skill', existingSlugs)
    const created = await window.api.aiConfig.createItem({
      type: 'skill',
      scope: 'global',
      slug,
      content: '---\ndescription: \ntrigger: auto\n---\n\n'
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

  return (
    <div className="flex min-h-full flex-col">
      {/* Header: back button + description + actions when drilled in */}
      {section !== null && (
        <div className="flex items-center justify-between gap-3 pb-4">
          <button
            onClick={() => setSection(null)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            {{ providers: 'Providers', instructions: 'Instructions', skill: 'Skills', mcp: 'MCP Servers', files: 'Files' }[section]}
          </button>

          <span className="flex-1 text-right text-xs text-muted-foreground">
            {section === 'providers' && 'Choose which AI coding tools to sync content to.'}
            {section === 'instructions' && 'Global instructions stored in the database. Not synced to any file.'}
            {section === 'skill' && 'Global skills shared across all projects. Synced to enabled providers.'}
            {section === 'mcp' && 'Browse and favorite MCP servers from the curated catalog.'}
            {section === 'files' && 'Global config files across all provider directories.'}
          </span>

          <div className="flex items-center gap-2">
            {isItemSection && (
              <Button
                size="sm"
                onClick={handleCreate}
                data-testid={`context-new-${section}`}
              >
                <Plus className="mr-1 size-3.5" />
                New
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Content area */}
      <div className="flex-1">
        {section === null ? (
          <OverviewPanel
            onNavigate={setSection}
            version={providerVersion + syncCheckVersion}
          />
        ) : section === 'providers' ? (
          <ProvidersPanel />
        ) : section === 'instructions' ? (
          <ProjectInstructions />
        ) : section === 'mcp' ? (
          <McpServersPanel mode="global" />
        ) : section === 'files' ? (
          <GlobalContextFiles />
        ) : isItemSection ? (
          <>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
                <Sparkles className="size-8 text-muted-foreground/40" />
                <p className="mt-3 text-sm font-medium text-foreground">No skills yet</p>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                  Skills give AI assistants reusable capabilities. Create one to get started.
                </p>
                <Button size="sm" className="mt-4" onClick={handleCreate}>
                  <Plus className="mr-1 size-3.5" />
                  Create skill
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
                        data-testid={`context-global-item-${item.slug}`}
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
}
