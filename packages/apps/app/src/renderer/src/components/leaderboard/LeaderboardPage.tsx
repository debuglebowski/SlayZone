import { useMemo, useState } from 'react'
import { Clock3, Flame, Layers3, Sparkles, Timer } from 'lucide-react'
import { Button } from '@slayzone/ui'

type Period = 'daily' | 'weekly' | 'monthly'
type MetricId = 'cycle_time' | 'tokens_used' | 'simultaneous_tasks' | 'streak' | 'focus_ratio'

interface MetricDef {
  id: MetricId
  label: string
  description: string
  lowerIsBetter: boolean
  icon: React.JSX.Element
}

interface LeaderboardRow {
  user: string
  value: number
  display: string
}

const PERIODS: Period[] = ['daily', 'weekly', 'monthly']
const USERS = [
  'Kalle',
  'Maya',
  'Rafi',
  'Ana',
  'Devon',
  'Sam',
  'Priya',
  'Noah',
  'Iris',
  'Luca',
  'Tina',
  'Oscar',
  'Zoe',
  'Mateo',
  'Sana',
  'Eli',
  'Ava',
  'Kai',
  'Nina',
  'Jonah',
  'Lea',
  'Niko',
  'Mina',
  'Theo',
  'Lina'
]

const METRICS: MetricDef[] = [
  {
    id: 'cycle_time',
    label: 'Top 10 Fastest Average Task Cycle Time',
    description: 'Average created-to-done duration',
    lowerIsBetter: true,
    icon: <Timer className="size-4" />
  },
  {
    id: 'tokens_used',
    label: 'Top 10 Most AI Tokens Used',
    description: 'Total AI token usage',
    lowerIsBetter: false,
    icon: <Sparkles className="size-4" />
  },
  {
    id: 'simultaneous_tasks',
    label: 'Top 10 Most Simultaneous Active Tasks',
    description: 'Highest concurrent task count',
    lowerIsBetter: false,
    icon: <Layers3 className="size-4" />
  },
  {
    id: 'streak',
    label: 'Top 10 Highest Task Completion Streak',
    description: 'Consecutive active completion days',
    lowerIsBetter: false,
    icon: <Flame className="size-4" />
  },
  {
    id: 'focus_ratio',
    label: 'Best Focus Ratio',
    description: 'Focused time over active time',
    lowerIsBetter: false,
    icon: <Clock3 className="size-4" />
  }
]
const COLUMN_METRICS: MetricDef[] = [
  METRICS.find((metric) => metric.id === 'cycle_time')!,
  METRICS.find((metric) => metric.id === 'tokens_used')!,
  METRICS.find((metric) => metric.id === 'simultaneous_tasks')!,
  METRICS.find((metric) => metric.id === 'streak')!
]

function formatValue(metric: MetricId, value: number): string {
  switch (metric) {
    case 'cycle_time': {
      const hours = Math.floor(value / 60)
      const minutes = value % 60
      return `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m`
    }
    case 'tokens_used':
      return value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)}M` : `${Math.round(value / 1_000)}k`
    case 'simultaneous_tasks':
      return `${value}`
    case 'streak':
      return `${value} days`
    case 'focus_ratio':
      return `${value}%`
    default:
      return `${value}`
  }
}

function buildRows(metric: MetricDef, period: Period): LeaderboardRow[] {
  const periodFactor = period === 'daily' ? 1 : period === 'weekly' ? 2 : 4
  const rows = USERS.map((user, idx) => {
    const seed = idx + 1
    let value = 0

    switch (metric.id) {
      case 'cycle_time':
        value = 55 + seed * 6 + periodFactor * 10
        break
      case 'tokens_used':
        value = 100_000 + seed * 52_000 * periodFactor
        break
      case 'simultaneous_tasks':
        value = Math.min(14, 2 + ((seed * 3 + periodFactor) % 11))
        break
      case 'streak':
        value = 2 + seed + periodFactor * 3
        break
      case 'focus_ratio':
        value = Math.min(96, 54 + ((seed * 5 + periodFactor * 4) % 43))
        break
    }

    return { user, value, display: formatValue(metric.id, value) }
  })

  rows.sort((a, b) => (metric.lowerIsBetter ? a.value - b.value : b.value - a.value))
  return rows
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function LeaderboardPage(): React.JSX.Element {
  const [period, setPeriod] = useState<Period>('weekly')
  const lists = useMemo(
    () =>
      COLUMN_METRICS.map((metric) => ({
        metric,
        rows: buildRows(metric, period).slice(0, 10)
      })),
    [period]
  )

  return (
    <div className="h-full overflow-hidden bg-[radial-gradient(1200px_400px_at_20%_-10%,color-mix(in_oklab,var(--primary)_12%,transparent),transparent_65%)]">
      <div className="mx-auto w-full h-full max-w-[1760px] p-6 flex flex-col gap-5">
        <section className="rounded-xl border bg-background/85 backdrop-blur-sm p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Leaderboard</h1>
              <p className="text-sm text-muted-foreground mt-2">
                See who&rsquo;s slaying cycle time, AI usage, concurrent workload, and completion streaks.
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-1">
              {PERIODS.map((value) => (
                <Button
                  key={value}
                  size="sm"
                  variant={period === value ? 'default' : 'ghost'}
                  onClick={() => setPeriod(value)}
                  className="capitalize"
                >
                  {value}
                </Button>
              ))}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 flex-1 min-h-0">
          {lists.map(({ metric, rows }) => (
            <div key={metric.id} className="rounded-xl border bg-background overflow-hidden min-w-0 h-full flex flex-col">
              <div className="px-4 py-3 border-b bg-muted/20">
                <div className="flex items-center gap-3 h-12">
                  <span className="text-muted-foreground">{metric.icon}</span>
                  <h2 className="text-sm font-semibold leading-tight overflow-hidden">{metric.label}</h2>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-auto">
                {rows.map((row, index) => (
                  <div key={row.user} className="flex items-center gap-3 px-3 py-3 border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                    <span className="inline-flex w-8 text-xs font-medium tabular-nums text-muted-foreground/70">#{index + 1}</span>
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted text-[11px] font-medium">
                      {initials(row.user)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{row.user}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">{row.display}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
