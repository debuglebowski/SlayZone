import { RefreshCw } from 'lucide-react'
import type { DateRange } from '../shared/types'
import { cn } from '@slayzone/ui'

const OPTIONS: { value: DateRange; label: string }[] = [
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: 'all', label: 'All' }
]

interface Props {
  range: DateRange
  onRangeChange: (range: DateRange) => void
  onRefresh: () => void
  loading: boolean
}

export function DateRangeSelector({ range, onRangeChange, onRefresh, loading }: Props) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex rounded-lg border bg-muted/30 p-0.5">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onRangeChange(opt.value)}
            className={cn(
              'px-3 py-1 text-sm font-medium rounded-md transition-colors',
              range === opt.value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <button
        onClick={onRefresh}
        disabled={loading}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
        aria-label="Refresh usage data"
      >
        <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
      </button>
    </div>
  )
}
