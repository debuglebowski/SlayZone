import type { AnalyticsSummary } from '../shared/types'
import { formatTokens } from './chart-theme'

function pct(part: number, total: number): string {
  if (total === 0) return '0%'
  return `${((part / total) * 100).toFixed(0)}%`
}

interface Props {
  data: AnalyticsSummary
}

export function SummaryCards({ data }: Props) {
  const totalTokens = data.totalInputTokens + data.totalOutputTokens

  const cards = [
    {
      label: 'Total',
      value: formatTokens(totalTokens),
      sub: 'tokens'
    },
    {
      label: 'Output',
      value: formatTokens(data.totalOutputTokens),
      sub: `${pct(data.totalOutputTokens, totalTokens)} of total`
    },
    {
      label: 'Input',
      value: formatTokens(data.totalInputTokens),
      sub: `${pct(data.totalInputTokens, totalTokens)} of total`
    },
    {
      label: 'Cache Hit',
      value: `${data.cacheHitPercent.toFixed(1)}%`,
      sub: `${formatTokens(data.totalCacheReadTokens)} read`
    }
  ]

  return (
    <div className="flex gap-3">
      {cards.map((card) => (
        <div key={card.label} className="flex-1 min-w-0 rounded-lg border bg-surface-2 p-4">
          <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight">{card.value}</p>
          {card.sub && <p className="mt-0.5 text-xs text-muted-foreground truncate">{card.sub}</p>}
        </div>
      ))}
    </div>
  )
}
