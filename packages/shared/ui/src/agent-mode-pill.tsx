import { ChevronDown, ShieldCheck, Eye, AlertTriangle } from 'lucide-react'
import { cn } from './utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu'

export type AgentMode = 'plan' | 'auto-accept' | 'bypass'

interface ModeMeta {
  label: string
  short: string
  description: string
  icon: typeof ShieldCheck
  /** Tailwind classes for chip background + foreground. */
  chip: string
  /** Hover background for trigger. */
  chipHover: string
}

const MODE_META: Record<AgentMode, ModeMeta> = {
  plan: {
    label: 'Plan mode',
    short: 'Plan',
    description: 'Read-only — investigation phase. No edits, no shell.',
    icon: Eye,
    chip: 'bg-sky-500/15 text-sky-600 dark:text-sky-300 ring-sky-500/30',
    chipHover: 'hover:bg-sky-500/25',
  },
  'auto-accept': {
    label: 'Auto-accept edits',
    short: 'Auto',
    description: 'Edits and tool calls auto-approved. Recommended default.',
    icon: ShieldCheck,
    chip: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 ring-emerald-500/30',
    chipHover: 'hover:bg-emerald-500/25',
  },
  bypass: {
    label: 'Bypass permissions',
    short: 'Bypass',
    description: 'All permission checks skipped. Use with caution.',
    icon: AlertTriangle,
    chip: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-500/30',
    chipHover: 'hover:bg-amber-500/25',
  },
}

const MODE_ORDER: AgentMode[] = ['plan', 'auto-accept', 'bypass']

/** Cycle to next mode, wrapping around. */
export function nextAgentMode(mode: AgentMode): AgentMode {
  const i = MODE_ORDER.indexOf(mode)
  return MODE_ORDER[(i + 1) % MODE_ORDER.length]
}

export interface AgentModePillProps {
  mode: AgentMode
  onChange: (next: AgentMode) => void
  disabled?: boolean
  /** Compact variant — icon + short label only. */
  compact?: boolean
  className?: string
}

export function AgentModePill({ mode, onChange, disabled, compact, className }: AgentModePillProps) {
  const meta = MODE_META[mode]
  const Icon = meta.icon
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full ring-1 px-2 py-0.5 text-[11px] font-medium transition-colors',
          meta.chip,
          meta.chipHover,
          disabled && 'opacity-50 cursor-not-allowed',
          className,
        )}
        title={meta.description}
        aria-label={`Agent mode: ${meta.label}`}
      >
        <Icon className="size-3" />
        <span>{compact ? meta.short : meta.label}</span>
        <ChevronDown className="size-3 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {MODE_ORDER.map((m) => {
          const itemMeta = MODE_META[m]
          const ItemIcon = itemMeta.icon
          const selected = m === mode
          return (
            <DropdownMenuItem
              key={m}
              onSelect={() => { if (m !== mode) onChange(m) }}
              className={cn('flex items-start gap-2 py-2', selected && 'bg-accent/40')}
            >
              <ItemIcon className="size-4 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium">{itemMeta.label}</div>
                <div className="text-[11px] text-muted-foreground leading-snug">
                  {itemMeta.description}
                </div>
              </div>
              {selected && <span className="text-[10px] text-muted-foreground self-center">current</span>}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
