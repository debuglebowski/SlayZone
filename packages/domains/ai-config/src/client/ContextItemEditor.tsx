import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { ArrowDownCircle, ArrowUpCircle, Library, Link2Off, Lock, RefreshCw, Store, Trash2 } from 'lucide-react'
import { Button, cn, DiffView, Input, Label, Textarea, Tooltip, TooltipContent, TooltipTrigger } from '@slayzone/ui'
import { repairSkillFrontmatter } from '../shared'
import type { AiConfigItem, CliProvider, ProjectSkillStatus, SkillUpdateInfo, SkillValidationState, UpdateAiConfigItemInput } from '../shared'
import { PROVIDER_LABELS } from '../shared/provider-registry'
import { getMarketplaceProvenance, getSkillFrontmatterActionLabel, getSkillValidation } from './skill-validation'
import { aggregateProviderSyncHealth, groupProvidersByPath, type ProviderGroup } from './sync-view-model'
import { useContextManagerStore } from './useContextManagerStore'

interface ContextItemEditorProps {
  item: AiConfigItem
  validationState?: SkillValidationState | null
  onUpdate: (patch: Omit<UpdateAiConfigItemInput, 'id'>) => Promise<void>
  onDelete: () => Promise<void>
  onClose: () => void
  readOnly?: boolean
  updateInfo?: SkillUpdateInfo | null
  onMarketplaceUpdate?: () => void
  onUnlink?: () => void
  syncStatus?: ProjectSkillStatus | null
  onSyncToDisk?: () => Promise<void>
  onSyncProviderToDisk?: (provider: CliProvider) => Promise<void>
  onPullProviderFromDisk?: (provider: CliProvider) => Promise<void>
}

const PROVIDER_ROW_ORDER: CliProvider[] = ['claude', 'codex', 'cursor', 'gemini', 'opencode', 'qwen', 'copilot']

export function ContextItemEditor({ item, validationState, onUpdate, onDelete, onClose, readOnly, updateInfo, onMarketplaceUpdate, onUnlink, syncStatus, onSyncToDisk, onSyncProviderToDisk, onPullProviderFromDisk }: ContextItemEditorProps) {
  const provenance = getMarketplaceProvenance(item)
  const isMarketplaceBound = !!provenance
  const isLibraryLinked = !isMarketplaceBound && !!readOnly && item.scope === 'library'
  const effectiveReadOnly = readOnly || isMarketplaceBound
  const navigateToMarketplaceEntry = useContextManagerStore((s) => s.navigateToMarketplaceEntry)
  const navigateToLibrarySkill = useContextManagerStore((s) => s.navigateToLibrarySkill)
  const [slug, setSlug] = useState(item.slug)
  const [content, setContent] = useState(item.content)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [syncingAll, setSyncingAll] = useState(false)
  const [syncingProvider, setSyncingProvider] = useState<CliProvider | null>(null)
  const [pullingProvider, setPullingProvider] = useState<CliProvider | null>(null)
  const [activeDiffProvider, setActiveDiffProvider] = useState<CliProvider | null>(null)

  const { aggregatedHealth, providerGroups, staleProviders } = useMemo(() => {
    if (!syncStatus) {
      return { aggregatedHealth: null, providerGroups: [] as ProviderGroup[], staleProviders: [] as CliProvider[] }
    }
    const health = aggregateProviderSyncHealth(syncStatus.providers)
    const groups = groupProvidersByPath(syncStatus.providers, PROVIDER_ROW_ORDER)
    const stales: CliProvider[] = []
    for (const group of groups) {
      if (group.syncHealth === 'stale') stales.push(group.providers[0])
    }
    return { aggregatedHealth: health, providerGroups: groups, staleProviders: stales }
  }, [syncStatus])

  const isStale = aggregatedHealth === 'stale' && staleProviders.length > 0

  useEffect(() => {
    if (activeDiffProvider && !staleProviders.includes(activeDiffProvider)) {
      setActiveDiffProvider(staleProviders[0] ?? null)
    }
  }, [activeDiffProvider, staleProviders])

  const autoSelectedItemRef = useRef<string | null>(null)
  useEffect(() => {
    if (autoSelectedItemRef.current === item.id) return
    autoSelectedItemRef.current = item.id
    setActiveDiffProvider(staleProviders[0] ?? null)
  }, [item.id, staleProviders])

  const activeDiffDisk = activeDiffProvider ? (syncStatus?.providers[activeDiffProvider]?.diskContent ?? null) : null
  const activeDiffGroupLabel = activeDiffProvider
    ? (providerGroups.find((g) => g.providers.includes(activeDiffProvider))?.providers.map((p) => PROVIDER_LABELS[p]).join(' / ') ?? PROVIDER_LABELS[activeDiffProvider])
    : null

  const handleSyncAllToDisk = async () => {
    if (!onSyncToDisk) return
    setSyncingAll(true)
    setError(null)
    try {
      await onSyncToDisk()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync')
    } finally {
      setSyncingAll(false)
    }
  }

  const handleSyncProvider = async (provider: CliProvider) => {
    if (!onSyncProviderToDisk) return
    setSyncingProvider(provider)
    setError(null)
    try {
      await onSyncProviderToDisk(provider)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync')
    } finally {
      setSyncingProvider(null)
    }
  }

  const handlePullProvider = async (provider: CliProvider) => {
    if (!onPullProviderFromDisk) return
    setPullingProvider(provider)
    setError(null)
    try {
      await onPullProviderFromDisk(provider)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pull')
    } finally {
      setPullingProvider(null)
    }
  }

  const anySyncBusy = syncingAll || syncingProvider !== null || pullingProvider !== null
  const effectiveValidation = validationState ?? getSkillValidation({
    type: item.type,
    slug: item.slug,
    content
  })

  useEffect(() => {
    setSlug(item.slug)
    setContent(item.content)
  }, [item.slug, item.content])

  const save = async (patch: Omit<UpdateAiConfigItemInput, 'id'>) => {
    setSaving(true)
    setError(null)
    try {
      await onUpdate(patch)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const isJson = slug.endsWith('.json')
  const jsonError = isJson && content.trim()
    ? (() => { try { JSON.parse(content); return null } catch (e) { return (e as Error).message } })()
    : null

  const fixFrontmatterLabel = getSkillFrontmatterActionLabel(effectiveValidation)

  const handleFixFrontmatter = async () => {
    const nextContent = repairSkillFrontmatter(item.slug, content)
    setContent(nextContent)
    await save({ content: nextContent })
  }

  return (
    <div className="flex-1 flex flex-col space-y-3 min-h-0 overflow-y-auto">
      {isStale && (
        <div
          className="rounded border border-amber-500/30 bg-amber-500/5"
          data-testid="context-item-editor-stale-banner"
        >
          <div className="flex items-center justify-between gap-3 border-b border-amber-500/20 px-2.5 py-1.5">
            <div className="flex items-center gap-2 text-xs">
              <RefreshCw className="size-3.5 text-amber-500" />
              <span className="font-medium text-amber-500">Skill is out of sync</span>
            </div>
            {onSyncToDisk && (
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[11px] gap-1 border-amber-500/30"
                onClick={() => void handleSyncAllToDisk()}
                disabled={anySyncBusy}
                data-testid="context-item-editor-sync-all-to-disk"
              >
                <ArrowUpCircle className="size-3" />
                {syncingAll ? 'Syncing...' : 'Sync all'}
              </Button>
            )}
          </div>
          <div className="divide-y divide-amber-500/10">
            {providerGroups.map((group) => {
              const stale = group.syncHealth === 'stale'
              const representative = group.providers[0]
              const active = activeDiffProvider !== null && group.providers.includes(activeDiffProvider)
              const thisSyncing = syncingProvider !== null && group.providers.includes(syncingProvider)
              const thisPulling = pullingProvider !== null && group.providers.includes(pullingProvider)
              const label = group.providers.map((p) => PROVIDER_LABELS[p]).join(' / ')
              const testSuffix = group.providers.join('-')
              return (
                <div
                  key={group.key}
                  className="flex items-center justify-between gap-3 px-2.5 py-1.5"
                  data-testid={`context-item-editor-provider-row-${testSuffix}`}
                >
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className={cn(
                        'size-1.5 rounded-full',
                        stale ? 'bg-amber-500' : group.syncHealth === 'synced' ? 'bg-emerald-500' : 'bg-muted-foreground/40'
                      )}
                    />
                    <span className="font-medium">{label}</span>
                    <span className="text-[11px] text-muted-foreground">{group.syncHealth}</span>
                  </div>
                  {stale && (
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant={active ? 'default' : 'outline'}
                        className="h-6 px-2 text-[11px]"
                        onClick={() => setActiveDiffProvider(active ? null : representative)}
                        data-testid={`context-item-editor-view-diff-${testSuffix}`}
                      >
                        {active ? 'Hide diff' : 'View diff'}
                      </Button>
                      {onPullProviderFromDisk && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-[11px] gap-1"
                              onClick={() => void handlePullProvider(representative)}
                              disabled={anySyncBusy}
                              data-testid={`context-item-editor-pull-provider-${testSuffix}`}
                            >
                              <ArrowDownCircle className="size-3" />
                              {thisPulling ? 'Pulling...' : 'File → Database'}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            Overwrite skill content in the Database with the contents of {label}'s File.
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {onSyncProviderToDisk && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-[11px] gap-1"
                              onClick={() => void handleSyncProvider(representative)}
                              disabled={anySyncBusy}
                              data-testid={`context-item-editor-sync-provider-${testSuffix}`}
                            >
                              <ArrowUpCircle className="size-3" />
                              {thisSyncing ? 'Syncing...' : 'Database → File'}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            Overwrite {label}'s File with the current skill content from the Database.
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="space-y-1">
        <Label className="text-xs">Filename</Label>
        <Input
          data-testid="context-item-editor-slug"
          className={`font-mono text-sm ${effectiveReadOnly ? 'opacity-50 cursor-not-allowed focus-visible:ring-0 focus-visible:border-input' : ''}`}
          placeholder="my-skill.md"
          value={slug}
          readOnly={effectiveReadOnly}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setSlug(e.target.value)
            setError(null)
          }}
          onBlur={(e: ChangeEvent<HTMLInputElement>) => {
            if (effectiveReadOnly) return
            const nextSlug = e.currentTarget.value
            setSlug(nextSlug)
            void save({ slug: nextSlug })
          }}
        />
      </div>

      {provenance && (
        <div className="flex items-center justify-between gap-2 rounded border border-border/50 bg-surface-3 px-2.5 py-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              <Store className="size-3" />
              Marketplace
            </span>
            <span>
              From <button onClick={() => navigateToMarketplaceEntry(provenance.registryId, provenance.entryId)} className="font-medium text-foreground hover:underline">{item.slug}</button> in the <button onClick={() => navigateToMarketplaceEntry(provenance.registryId, provenance.entryId)} className="font-medium text-foreground hover:underline">{provenance.registryName ?? 'Marketplace'}</button> registry
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {updateInfo && onMarketplaceUpdate ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-[11px] gap-1 text-amber-500 border-amber-500/30"
                    onClick={onMarketplaceUpdate}
                    data-testid="context-item-editor-sync-marketplace"
                  >
                    <ArrowUpCircle className="size-3" />
                    Sync
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Update to the latest marketplace version</TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0}>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-[11px] gap-1 pointer-events-none"
                      disabled
                      data-testid="context-item-editor-sync-marketplace"
                    >
                      <ArrowUpCircle className="size-3" />
                      Sync
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>Up to date with marketplace</TooltipContent>
              </Tooltip>
            )}
            {onUnlink && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-[11px] gap-1"
                    onClick={onUnlink}
                    data-testid="context-item-editor-unlink-marketplace"
                  >
                    <Link2Off className="size-3" />
                    Unlink
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Convert to editable local copy</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-[11px] gap-1 ml-2"
                  onClick={() => navigateToMarketplaceEntry(provenance.registryId, provenance.entryId)}
                  data-testid="context-item-editor-go-to-source"
                >
                  <Store className="size-3" />
                  Go to source
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open in {provenance.registryName ?? 'Marketplace'}</TooltipContent>
            </Tooltip>
          </div>
        </div>
      )}

      {isLibraryLinked && (
        <div className="flex items-center justify-between gap-2 rounded border border-border/50 bg-surface-3 px-2.5 py-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              <Library className="size-3" />
              Library
            </span>
            <span>
              From <button onClick={() => navigateToLibrarySkill(item.id)} className="font-medium text-foreground hover:underline">{item.slug}</button> in the <button onClick={() => navigateToLibrarySkill(item.id)} className="font-medium text-foreground hover:underline">library</button>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-[11px] gap-1 pointer-events-none"
                    disabled
                    data-testid="context-item-editor-sync-library"
                  >
                    <ArrowUpCircle className="size-3" />
                    Sync
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Up to date with library</TooltipContent>
            </Tooltip>
            {onUnlink && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-[11px] gap-1"
                    onClick={onUnlink}
                    data-testid="context-item-editor-unlink-library"
                  >
                    <Link2Off className="size-3" />
                    Unlink
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Remove from project</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-[11px] gap-1 ml-2"
                  onClick={() => navigateToLibrarySkill(item.id)}
                  data-testid="context-item-editor-go-to-source"
                >
                  <Library className="size-3" />
                  Go to source
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open in library</TooltipContent>
            </Tooltip>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col space-y-1 min-h-0">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs">
            {activeDiffGroupLabel ? `Diff — ${activeDiffGroupLabel}` : 'Content'}
          </Label>
          {isLibraryLinked && !activeDiffProvider && (
            <div className="flex items-center gap-1.5 text-[11px] text-amber-500">
              <Lock className="size-3" />
              <span>Open this skill in the library to edit it.</span>
            </div>
          )}
        </div>
        {activeDiffProvider ? (
          activeDiffDisk !== null ? (
            <DiffView
              left={activeDiffDisk}
              right={item.content}
              leftLabel="File"
              rightLabel="Database"
              className="flex-1 min-h-0"
            />
          ) : (
            <div className="flex-1 flex items-center justify-center rounded border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
              File missing. Click Sync to write it.
            </div>
          )
        ) : (
          <Textarea
            data-testid="context-item-editor-content"
            className={cn(
              'flex-1 min-h-48 max-h-none field-sizing-fixed font-mono text-sm resize-none',
              effectiveReadOnly && 'opacity-50 cursor-not-allowed focus-visible:ring-0 focus-visible:border-input'
            )}
            placeholder="Write your content here..."
            value={content}
            readOnly={effectiveReadOnly}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
              setContent(e.target.value)
              setError(null)
            }}
            onBlur={(e: ChangeEvent<HTMLTextAreaElement>) => {
              if (effectiveReadOnly) return
              const nextContent = e.currentTarget.value
              setContent(nextContent)
              void save({ content: nextContent })
            }}
          />
        )}
      </div>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {effectiveValidation && effectiveValidation.status !== 'valid' && (
        <div className="rounded border border-destructive/20 bg-destructive/5 px-2.5 py-2">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs font-medium text-destructive">
              {effectiveValidation.status === 'invalid' ? 'Frontmatter is invalid' : 'Frontmatter warning'}
            </p>
            {fixFrontmatterLabel && (
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[11px]"
                data-testid="context-item-editor-fix-frontmatter"
                onClick={() => void handleFixFrontmatter()}
              >
                {fixFrontmatterLabel}
              </Button>
            )}
          </div>
          <div className="mt-1 space-y-0.5">
            {effectiveValidation.issues.map((issue, index) => (
              <p key={`${issue.code}-${index}`} className="text-[11px] text-destructive/90">
                {issue.line ? `Line ${issue.line}: ` : ''}
                {issue.message}
              </p>
            ))}
          </div>
        </div>
      )}

      {isJson && jsonError && (
        <div className="rounded border border-destructive/20 bg-destructive/5 px-2.5 py-2">
          <p className="text-[11px] text-destructive">{jsonError}</p>
        </div>
      )}
      {isJson && !jsonError && content.trim() && (
        <p className="text-[11px] text-green-600 dark:text-green-400">Valid JSON</p>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        <Button size="sm" variant="ghost" onClick={onClose} data-testid="context-item-editor-close">
          Close
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">
            {isMarketplaceBound
              ? 'Read-only (marketplace skill)'
              : readOnly
                ? 'Read-only (library skill)'
                : saving ? 'Saving...' : 'Autosave on blur'}
          </span>
          {!effectiveReadOnly && (
            <Button size="sm" variant="ghost" className="text-destructive" onClick={onDelete}>
              <Trash2 className="mr-1 size-3" />
              Delete
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
