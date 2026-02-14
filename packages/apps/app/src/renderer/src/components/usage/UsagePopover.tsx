import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import {
  cn,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipTrigger,
  TooltipContent
} from '@slayzone/ui'
import type { ProviderUsage, UsageWindow } from '@slayzone/terminal/shared'

interface UsagePopoverProps {
  data: ProviderUsage[]
  onRefresh: () => void
}

function barColor(pct: number) {
  if (pct >= 85) return 'bg-red-500'
  if (pct >= 60) return 'bg-yellow-500'
  return 'bg-green-500'
}

function peakUtilization(p: ProviderUsage): number {
  return Math.max(p.fiveHour?.utilization ?? 0, p.sevenDay?.utilization ?? 0)
}

function formatDuration(ms: number): string {
  if (ms <= 0) return 'now'
  const mins = Math.floor(ms / 60_000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ${mins % 60}m`
  const days = Math.floor(hrs / 24)
  return `${days}d ${hrs % 24}h`
}

function formatReset(iso: string): string {
  return formatDuration(new Date(iso).getTime() - Date.now())
}

function formatAgo(epochMs: number): string {
  return formatDuration(Date.now() - epochMs)
}

function InlineBar({ pct, label }: { pct: number; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1 cursor-pointer">
          <span className="text-[10px] text-muted-foreground leading-none">{label}</span>
          <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', barColor(pct))}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {label}: {Math.round(pct)}%
      </TooltipContent>
    </Tooltip>
  )
}

function WindowRow({ label, w }: { label: string; w: UsageWindow }) {
  const reset = formatReset(w.resetsAt)
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-8 shrink-0">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', barColor(w.utilization))}
          style={{ width: `${Math.min(w.utilization, 100)}%` }}
        />
      </div>
      <span className="text-xs tabular-nums w-8 text-right">{Math.round(w.utilization)}%</span>
      <span className="text-[10px] text-muted-foreground w-16 shrink-0 text-right">
        {reset}
      </span>
    </div>
  )
}

function ProviderSection({ usage }: { usage: ProviderUsage }) {
  if (usage.error) {
    return (
      <div className="space-y-1">
        <div className="text-xs font-medium">{usage.label}</div>
        <div className="text-xs text-muted-foreground">{usage.error}</div>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium flex-1">{usage.label}</span>
        <span className="text-[10px] text-muted-foreground w-16 shrink-0 text-right">Resets in</span>
      </div>
      {usage.fiveHour && <WindowRow label="5h" w={usage.fiveHour} />}
      {usage.sevenDay && <WindowRow label="7d" w={usage.sevenDay} />}
      {usage.sevenDayOpus && <WindowRow label="Opus" w={usage.sevenDayOpus} />}
      {usage.sevenDaySonnet && <WindowRow label="Son." w={usage.sevenDaySonnet} />}
    </div>
  )
}

export function UsagePopover({ data, onRefresh }: UsagePopoverProps) {
  const [open, setOpen] = useState(false)

  const withData = data.filter((p) => !p.error && (p.fiveHour || p.sevenDay))
  const inlineBars = withData
    .map((p) => ({ label: p.label, pct: peakUtilization(p) }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 2)

  if (data.length === 0) return null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-2 h-7 px-1 transition-colors text-muted-foreground hover:text-foreground"
          onClick={() => setOpen(!open)}
        >
          {inlineBars.length > 0 ? (
            inlineBars.map((b) => <InlineBar key={b.label} pct={b.pct} label={b.label} />)
          ) : (
            <span className="text-[10px]">Usage</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="w-72 p-3 space-y-3">
        {data.map((p) => (
          <ProviderSection key={p.provider} usage={p} />
        ))}
        <div className="flex items-center justify-between pt-1 border-t">
          <span className="text-[10px] text-muted-foreground">
            {data[0]?.fetchedAt
              ? `Updated ${formatAgo(data[0].fetchedAt)} ago`
              : ''}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRefresh()
            }}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="size-3" />
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
