import { Check, AlertCircle, ChevronDown, Loader2 } from 'lucide-react'
import { Button, DiffView, Tooltip, TooltipContent, TooltipTrigger, cn } from '@slayzone/ui'
import type { SyncHealth } from '../shared'
import { canShowProviderPull, canShowProviderPush, toSyncBadgeLabel } from './sync-view-model'

// ============================================================
// StatusBadge
// ============================================================

export function StatusBadge({ syncHealth }: { syncHealth: SyncHealth }) {
  const health = syncHealth
  if (health === 'synced') return (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-xs text-green-700 dark:text-green-300">
      <Check className="size-3" /> {toSyncBadgeLabel(health)}
    </span>
  )
  if (health === 'stale') return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-300">
      <AlertCircle className="size-3" /> {toSyncBadgeLabel(health)}
    </span>
  )
  if (health === 'unmanaged') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        {toSyncBadgeLabel(health)}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
      {toSyncBadgeLabel(health)}
    </span>
  )
}

// ============================================================
// ProviderFileCard
// ============================================================

export interface ProviderFileCardProps {
  testIdPrefix: string
  testIdSuffix?: string
  provider: string
  path: string
  syncHealth: SyncHealth
  isPushing: boolean
  isPulling: boolean
  isExpanded: boolean
  syncingAll: boolean
  disk: string | undefined
  /** Right-side content for diff. For skills this is the expected transformed content; for instructions it's the app content. */
  expected: string | undefined
  rightLabel?: string
  canPush?: boolean
  onToggleExpand: () => void
  onPush: () => void
  onPull: () => void
}

export function ProviderFileCard({
  testIdPrefix, testIdSuffix, provider, path, syncHealth,
  isPushing, isPulling, isExpanded, syncingAll,
  disk, expected, rightLabel = 'Expected content', canPush = true,
  onToggleExpand, onPush, onPull
}: ProviderFileCardProps) {
  const health = syncHealth
  const isStale = canShowProviderPull(health)
  const showPush = canShowProviderPush({ syncHealth: health, canPush, isPushing })
  const suffix = testIdSuffix ? `-${testIdSuffix}` : ''

  return (
    <div data-testid={`${testIdPrefix}-provider-card-${provider}${suffix}`} className="rounded-lg border bg-surface-3">
      <div
        data-testid={`${testIdPrefix}-provider-row-${provider}${suffix}`}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5',
          isStale && 'cursor-pointer hover:bg-muted/30'
        )}
        onClick={isStale ? onToggleExpand : undefined}
      >
        {isStale && (
          <button
            type="button"
            data-testid={`${testIdPrefix}-toggle-${provider}${suffix}`}
            className="inline-flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
            onClick={(e) => { e.stopPropagation(); onToggleExpand() }}
          >
            <ChevronDown className={cn('size-4 transition-transform', !isExpanded && '-rotate-90')} />
          </button>
        )}
        <span className="flex-1 font-mono text-sm truncate">{path}</span>
        <StatusBadge syncHealth={syncHealth} />
        {isStale && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                data-testid={`${testIdPrefix}-pull-${provider}${suffix}`}
                size="sm" variant="outline"
                className="h-7 px-2 text-[11px]"
                disabled={isPulling || syncingAll}
                onClick={(e) => { e.stopPropagation(); onPull() }}
              >
                {isPulling && <Loader2 className="size-3.5 animate-spin" />}
                File → Database
              </Button>
            </TooltipTrigger>
            <TooltipContent>Pull from {path}</TooltipContent>
          </Tooltip>
        )}
        {showPush && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                data-testid={`${testIdPrefix}-push-${provider}${suffix}`}
                size="sm" variant={isStale ? 'default' : 'outline'}
                className="h-7 px-2 text-[11px]"
                disabled={isPushing || syncingAll}
                onClick={(e) => { e.stopPropagation(); onPush() }}
              >
                {isPushing && <Loader2 className="size-3.5 animate-spin" />}
                Database → File
              </Button>
            </TooltipTrigger>
            <TooltipContent>Push to {path}</TooltipContent>
          </Tooltip>
        )}
      </div>

      {isStale && isExpanded && (
        disk === undefined || expected === undefined ? (
          <div data-testid={`${testIdPrefix}-diff-${provider}${suffix}`} className="flex items-center justify-center border-t py-6">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div data-testid={`${testIdPrefix}-diff-${provider}${suffix}`}>
            <DiffView
              left={disk} right={expected}
              leftLabel={`${path} (File)`}
              rightLabel={rightLabel}
              className="border-t border-x-0 border-b-0 rounded-none"
            />
          </div>
        )
      )}
    </div>
  )
}
