import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import {
  ChevronDown, ChevronRight,
  Plus, Loader2, X
} from 'lucide-react'
import {
  Button, IconButton, Input, Label,
  Tabs, TabsContent, TabsList, TabsTrigger,
  Textarea, Tooltip, TooltipContent, TooltipTrigger, cn, toast
} from '@slayzone/ui'
import type {
  AiConfigItem, AiConfigItemType, CliProvider,
  ProjectSkillStatus, ProviderSyncStatus
} from '../shared'
import { PROVIDER_PATHS } from '../shared/provider-registry'
import { AddItemPicker } from './AddItemPicker'
import { StatusBadge, ProviderFileCard } from './SyncComponents'

// ============================================================
// Types & Helpers
// ============================================================

interface ItemSectionProps {
  type: AiConfigItemType
  linkedItems: ProjectSkillStatus[]
  localItems: AiConfigItem[]
  enabledProviders: CliProvider[]
  projectId: string
  projectPath: string
  onChanged: () => void
}

interface ProviderRow {
  provider: CliProvider
  path: string
  status: ProviderSyncStatus
}

function providerSupportsType(provider: CliProvider): boolean {
  return !!PROVIDER_PATHS[provider]?.skillsDir
}

function aggregateStatus(
  providers: Partial<Record<CliProvider, { status: ProviderSyncStatus }>>
): ProviderSyncStatus {
  const statuses = Object.values(providers).map(p => p?.status).filter(Boolean) as ProviderSyncStatus[]
  if (statuses.length === 0) return 'not_synced'
  if (statuses.every(s => s === 'synced')) return 'synced'
  if (statuses.some(s => s === 'out_of_sync')) return 'out_of_sync'
  return 'not_synced'
}

// ============================================================
// Hook: useSkillItem
// ============================================================

function useSkillItem({
  item, providers, enabledProviders, isLocal, projectId, projectPath, onChanged
}: {
  item: AiConfigItem
  providers: ProjectSkillStatus['providers']
  enabledProviders: CliProvider[]
  isLocal: boolean
  projectId: string
  projectPath: string
  onChanged: () => void
}) {
  const [slug, setSlugRaw] = useState(item.slug)
  const [content, setContent] = useState(item.content)
  const [slugDirty, setSlugDirty] = useState(false)
  const [savingSlug, setSavingSlug] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [expandedProviders, setExpandedProviders] = useState<Set<CliProvider>>(new Set())
  const [diskContents, setDiskContents] = useState<Partial<Record<CliProvider, string>>>({})
  const [expectedContents, setExpectedContents] = useState<Partial<Record<CliProvider, string>>>({})
  const [syncingProvider, setSyncingProvider] = useState<CliProvider | null>(null)
  const [pullingProvider, setPullingProvider] = useState<CliProvider | null>(null)
  const [syncingAll, setSyncingAll] = useState(false)

  useEffect(() => {
    setContent(item.content)
    setSlugRaw(item.slug)
    setSlugDirty(false)
  }, [item.content, item.slug])

  const providerRows: ProviderRow[] = enabledProviders
    .filter(p => providerSupportsType(p))
    .map(p => {
      const info = providers[p]
      const path = info?.path ?? `${PROVIDER_PATHS[p]?.skillsDir}/${item.slug}/SKILL.md`
      const status = info?.status ?? 'not_synced'
      return { provider: p, path, status }
    })

  const saveContent = useCallback(async (text: string) => {
    try {
      await window.api.aiConfig.updateItem({ id: item.id, content: text })
      setExpectedContents({})
      onChanged()
    } catch { /* silent */ }
  }, [item.id, onChanged])

  const handleContentChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    setContent(text)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => void saveContent(text), 800)
  }

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
  }, [])

  const handleSlugSave = async () => {
    setSavingSlug(true)
    try {
      await window.api.aiConfig.updateItem({ id: item.id, slug })
      setSlugDirty(false)
      setExpectedContents({})
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Rename failed')
    } finally {
      setSavingSlug(false)
    }
  }

  const handleRevert = async () => {
    try {
      await window.api.aiConfig.syncLinkedFile(projectId, projectPath, item.id)
      toast.success(`Reverted ${item.slug} to global`)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Revert failed')
    }
  }

  const loadDiskAndExpected = useCallback(async (provider: CliProvider) => {
    const [disk, expected] = await Promise.all([
      window.api.aiConfig.readProviderSkill(projectPath, provider, item.id),
      window.api.aiConfig.getExpectedSkillContent(projectPath, provider, item.id),
    ])
    setDiskContents(prev => ({ ...prev, [provider]: disk.exists ? disk.content : '' }))
    setExpectedContents(prev => ({ ...prev, [provider]: expected }))
  }, [projectPath, item.id])

  const toggleExpanded = (provider: CliProvider) => {
    setExpandedProviders(prev => {
      const next = new Set(prev)
      if (next.has(provider)) {
        next.delete(provider)
      } else {
        next.add(provider)
        void loadDiskAndExpected(provider)
      }
      return next
    })
  }

  const handlePush = async (provider: CliProvider) => {
    setSyncingProvider(provider)
    try {
      await window.api.aiConfig.syncLinkedFile(projectId, projectPath, item.id, provider)
      const expected = expectedContents[provider]
      if (expected !== undefined) {
        setDiskContents(prev => ({ ...prev, [provider]: expected }))
      }
      onChanged()
    } finally {
      setSyncingProvider(null)
    }
  }

  const handlePull = async (provider: CliProvider) => {
    setPullingProvider(provider)
    try {
      await window.api.aiConfig.pullProviderSkill(projectId, projectPath, provider, item.id)
      onChanged()
    } finally {
      setPullingProvider(null)
    }
  }

  const handleSyncAll = async () => {
    setSyncingAll(true)
    try {
      await window.api.aiConfig.syncLinkedFile(projectId, projectPath, item.id)
      const updated: Partial<Record<CliProvider, string>> = {}
      for (const { provider } of providerRows) {
        const expected = expectedContents[provider]
        if (expected !== undefined) updated[provider] = expected
      }
      setDiskContents(prev => ({ ...prev, ...updated }))
      onChanged()
    } finally {
      setSyncingAll(false)
    }
  }

  return {
    item, slug, content, slugDirty, savingSlug, isLocal,
    providerRows, expandedProviders, diskContents, expectedContents,
    syncingProvider, pullingProvider, syncingAll,
    setSlug: (v: string) => { setSlugRaw(v); setSlugDirty(v !== item.slug) },
    handleContentChange, handleSlugSave, handleRevert,
    toggleExpanded, handlePush, handlePull, handleSyncAll,
  }
}

// ============================================================
// Skill item detail (tabbed: Content | Sync)
// ============================================================

function SkillItemDetail({ item, providers, enabledProviders, isLocal, projectId, projectPath, onChanged, onRemove }: {
  item: AiConfigItem; providers: ProjectSkillStatus['providers']; enabledProviders: CliProvider[]
  isLocal: boolean; projectId: string; projectPath: string; onChanged: () => void
  onRemove: () => void
}) {
  const sk = useSkillItem({ item, providers, enabledProviders, isLocal, projectId, projectPath, onChanged })
  const [expanded, setExpanded] = useState(false)
  const status = isLocal ? 'not_synced' as ProviderSyncStatus : aggregateStatus(providers)

  return (
    <div data-testid={`project-context-item-skill-${item.slug}`}>
      {/* Collapsed row */}
      <div
        className={cn(
          'flex items-center gap-2 rounded-md border px-3 py-2 transition-colors cursor-pointer',
          expanded ? 'bg-muted/50 border-primary/30' : 'hover:bg-muted/30'
        )}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded
          ? <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
          : <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
        }
        <span className="flex-1 truncate font-mono text-xs">
          {item.slug}
          {isLocal && <span className="ml-1.5 font-sans text-[10px] text-muted-foreground">(local)</span>}
        </span>
        <StatusBadge status={status} />
        <IconButton
          aria-label="Remove skill"
          size="icon-sm" variant="ghost"
          className="size-6 text-muted-foreground hover:text-destructive shrink-0"
          onClick={(e) => { e.stopPropagation(); onRemove() }}
        >
          <X className="size-3" />
        </IconButton>
      </div>

      {/* Expanded: filename + tabs */}
      {expanded && (
        <div className="mt-1 rounded-lg border bg-muted/20 p-4 space-y-3">
          <Tabs defaultValue="content">
            {/* Filename + tabs on same row */}
            <div className="flex items-end gap-3">
              <div className="flex-1 min-w-0 space-y-1">
                <Label className="text-xs text-muted-foreground">Filename</Label>
                <div className="flex items-center gap-2">
                  <Input
                    data-testid="skill-detail-filename"
                    className="font-mono text-xs"
                    value={sk.slug}
                    onChange={(e) => sk.setSlug(e.target.value)}
                  />
                  {sk.slugDirty && (
                    <Button data-testid="skill-detail-rename" size="sm" onClick={sk.handleSlugSave} disabled={sk.savingSlug}>
                      {sk.savingSlug ? 'Renaming...' : 'Rename'}
                    </Button>
                  )}
                </div>
              </div>
              <TabsList className="h-8 shrink-0">
                <TabsTrigger value="content" className="text-xs px-3">Content</TabsTrigger>
                <TabsTrigger value="sync" className="text-xs px-3">
                  Sync
                  {status === 'out_of_sync' && (
                    <span className="ml-1.5 inline-flex size-2 rounded-full bg-amber-500" />
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="content" className="space-y-3">
              <Textarea
                data-testid="skill-detail-content"
                className="min-h-[200px] resize-y font-mono text-sm"
                placeholder="Write your skill content here."
                value={sk.content}
                onChange={sk.handleContentChange}
              />
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">
                  Source: {sk.isLocal ? 'Project only' : 'Global library'}
                </span>
                {!sk.isLocal && (
                  <Button data-testid="skill-detail-revert" size="sm" variant="outline" onClick={sk.handleRevert}>
                    Revert to global
                  </Button>
                )}
              </div>
            </TabsContent>

            <TabsContent value="sync" className="space-y-3">
              {sk.providerRows.length > 0 ? (
                <>
                  <div className="space-y-2">
                    {sk.providerRows.map(row => (
                      <ProviderFileCard
                        key={row.provider}
                        testIdPrefix="skill"
                        testIdSuffix={sk.item.slug}
                        provider={row.provider}
                        path={row.path}
                        status={row.status}
                        isPushing={sk.syncingProvider === row.provider}
                        isPulling={sk.pullingProvider === row.provider}
                        isExpanded={sk.expandedProviders.has(row.provider)}
                        syncingAll={sk.syncingAll}
                        disk={sk.diskContents[row.provider]}
                        expected={sk.expectedContents[row.provider]}
                        onToggleExpand={() => sk.toggleExpanded(row.provider)}
                        onPush={() => void sk.handlePush(row.provider)}
                        onPull={() => void sk.handlePull(row.provider)}
                      />
                    ))}
                  </div>
                  {sk.providerRows.length > 1 && (
                    <div className="flex items-center justify-end">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            data-testid={`skill-push-all-${sk.item.slug}`}
                            size="sm"
                            onClick={sk.handleSyncAll}
                            disabled={sk.syncingAll || !!sk.syncingProvider}
                          >
                            {sk.syncingAll && <Loader2 className="size-3.5 animate-spin" />}
                            Config → All Files
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Overwrite all provider skill files on disk</TooltipContent>
                      </Tooltip>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">No providers configured</p>
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Main Export
// ============================================================

export function ItemSection({
  type, linkedItems, localItems, enabledProviders,
  projectId, projectPath, onChanged
}: ItemSectionProps) {
  const [showPicker, setShowPicker] = useState(false)

  const allItems = [
    ...localItems.map(item => ({ item, providers: {} as ProjectSkillStatus['providers'], isLocal: true })),
    ...linkedItems.map(s => ({ item: s.item, providers: s.providers, isLocal: s.item.scope === 'project' }))
  ]
  const existingLinks = linkedItems.map(s => s.item.id)

  const handleRemove = async (itemId: string, isLocal: boolean) => {
    if (isLocal) {
      await window.api.aiConfig.deleteItem(itemId)
    } else {
      await window.api.aiConfig.removeProjectSelection(projectId, itemId)
    }
    onChanged()
  }

  return (
    <div>
      <div className="space-y-1">
        {allItems.map(({ item, providers, isLocal }) => (
          <SkillItemDetail
            key={item.id}
            item={item} providers={providers} enabledProviders={enabledProviders}
            isLocal={isLocal} projectId={projectId} projectPath={projectPath}
            onChanged={onChanged} onRemove={() => handleRemove(item.id, isLocal)}
          />
        ))}
      </div>

      <div
        data-testid={`project-context-add-${type}`}
        className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2 cursor-pointer text-muted-foreground transition-colors hover:bg-muted/15 hover:text-foreground mt-1"
        onClick={() => setShowPicker(true)}
      >
        <Plus className="size-3 shrink-0" />
        <span className="text-xs">Add skill</span>
      </div>

      <AddItemPicker
        open={showPicker}
        onOpenChange={setShowPicker}
        type={type}
        projectId={projectId}
        projectPath={projectPath}
        enabledProviders={enabledProviders}
        existingLinks={existingLinks}
        onAdded={() => { setShowPicker(false); onChanged() }}
      />
    </div>
  )
}
