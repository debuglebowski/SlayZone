import { Check, AlertCircle, ChevronDown, Loader2 } from 'lucide-react'
import { Button, DiffView, Tooltip, TooltipContent, TooltipTrigger, cn } from '@slayzone/ui'
import type { ProviderSyncStatus } from '../shared'

// ============================================================
// StatusBadge
// ============================================================

export function StatusBadge({ status }: { status: ProviderSyncStatus }) {
  if (status === 'synced') return (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-xs text-green-700 dark:text-green-300">
      <Check className="size-3" /> Synced
    </span>
  )
  if (status === 'out_of_sync') return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-300">
      <AlertCircle className="size-3" /> Stale
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
      Not synced
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
  status: ProviderSyncStatus
  isPushing: boolean
  isPulling: boolean
  isExpanded: boolean
  syncingAll: boolean
  disk: string | undefined
  /** Right-side content for diff. For skills this is the expected transformed content; for instructions it's the app content. */
  expected: string | undefined
  rightLabel?: string
  onToggleExpand: () => void
  onPush: () => void
  onPull: () => void
}

export function ProviderFileCard({
  testIdPrefix, testIdSuffix, provider, path, status,
  isPushing, isPulling, isExpanded, syncingAll,
  disk, expected, rightLabel = 'Expected content',
  onToggleExpand, onPush, onPull
}: ProviderFileCardProps) {
  const isStale = status === 'out_of_sync'
  const suffix = testIdSuffix ? `-${testIdSuffix}` : ''

  return (
    <div data-testid={`${testIdPrefix}-provider-card-${provider}${suffix}`} className="rounded-lg border">
      <div
        className={cn(
          'flex items-center gap-3 px-3 py-2.5',
          isStale && 'cursor-pointer hover:bg-muted/30'
        )}
        onClick={isStale ? onToggleExpand : undefined}
      >
        {isStale && (
          <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', !isExpanded && '-rotate-90')} />
        )}
        <span className="flex-1 font-mono text-sm truncate">{path}</span>
        <StatusBadge status={status} />
        {isStale && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                data-testid={`${testIdPrefix}-pull-${provider}${suffix}`}
                size="sm" variant="outline"
                disabled={isPulling || syncingAll}
                onClick={(e) => { e.stopPropagation(); onPull() }}
              >
                {isPulling && <Loader2 className="size-3.5 animate-spin" />}
                File → Config
              </Button>
            </TooltipTrigger>
            <TooltipContent>Pull from {path}</TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              data-testid={`${testIdPrefix}-push-${provider}${suffix}`}
              size="sm" variant={isStale ? 'default' : 'outline'}
              disabled={isPushing || syncingAll}
              onClick={(e) => { e.stopPropagation(); onPush() }}
            >
              {isPushing && <Loader2 className="size-3.5 animate-spin" />}
              Config → File
            </Button>
          </TooltipTrigger>
          <TooltipContent>Push to {path}</TooltipContent>
        </Tooltip>
      </div>

      {isStale && isExpanded && (
        disk === undefined || expected === undefined ? (
          <div className="flex items-center justify-center border-t py-6">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <DiffView
            left={disk} right={expected}
            leftLabel={`${path} (on disk)`}
            rightLabel={rightLabel}
            className="border-t border-x-0 border-b-0 rounded-none"
          />
        )
      )}
    </div>
  )
}
