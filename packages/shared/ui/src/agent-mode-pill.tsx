import { ChevronDown, ShieldCheck, Eye, AlertTriangle, Zap } from 'lucide-react'
import { cn } from './utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu'

export type AgentMode = 'plan' | 'auto-accept' | 'auto' | 'bypass'

/** Capability info for the `auto` mode (Max/Team/Enterprise + opt-in). */
export interface AutoModeCapability {
  eligible: boolean
  optedIn: boolean
}

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
    short: 'Auto-accept',
    description: 'Edits and tool calls auto-approved. Recommended default.',
    icon: ShieldCheck,
    chip: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 ring-emerald-500/30',
    chipHover: 'hover:bg-emerald-500/25',
  },
  auto: {
    label: 'Auto mode',
    short: 'Auto',
    description: 'Continuous autonomous execution. Requires Max/Team/Enterprise + opt-in.',
    icon: Zap,
    chip: 'bg-violet-500/15 text-violet-600 dark:text-violet-300 ring-violet-500/30',
    chipHover: 'hover:bg-violet-500/25',
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

const MODE_ORDER: AgentMode[] = ['plan', 'auto-accept', 'auto', 'bypass']

/** Cycle to next mode, wrapping around. Skips `auto` when not enabled. */
export function nextAgentMode(mode: AgentMode, autoEnabled = false): AgentMode {
  const order = autoEnabled ? MODE_ORDER : MODE_ORDER.filter((m) => m !== 'auto')
  const i = order.indexOf(mode)
  if (i === -1) return order[0]
  return order[(i + 1) % order.length]
}

export interface AgentModePillProps {
  mode: AgentMode
  onChange: (next: AgentMode) => void
  disabled?: boolean
  /** Compact variant — icon + short label only. */
  compact?: boolean
  className?: string
  /**
   * Auto-mode capability. When omitted or `eligible: false`, the `auto` option
   * is hidden entirely. When eligible but not opted in, the option is shown
   * disabled with a hint to opt in via the `claude` CLI.
   */
  autoCapability?: AutoModeCapability
}

export function AgentModePill({ mode, onChange, disabled, compact, className, autoCapability }: AgentModePillProps) {
  const meta = MODE_META[mode]
  const Icon = meta.icon
  const visibleModes = MODE_ORDER.filter((m) => m !== 'auto' || autoCapability?.eligible === true)
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
        {visibleModes.map((m) => {
          const itemMeta = MODE_META[m]
          const ItemIcon = itemMeta.icon
          const selected = m === mode
          // `auto` is selectable only when eligible AND opted in. Eligible-but-not-opted-in
          // surfaces the option disabled with an opt-in hint instead of hiding it.
          const itemDisabled = m === 'auto' && autoCapability?.optedIn !== true
          const description =
            m === 'auto' && autoCapability && !autoCapability.optedIn
              ? 'Run `claude` once and accept the auto-mode prompt to enable.'
              : itemMeta.description
          return (
            <DropdownMenuItem
              key={m}
              disabled={itemDisabled}
              onSelect={(e) => {
                if (itemDisabled) {
                  e.preventDefault()
                  return
                }
                if (m !== mode) onChange(m)
              }}
              className={cn(
                'flex items-start gap-2 py-2',
                selected && 'bg-accent/40',
                itemDisabled && 'opacity-50',
              )}
            >
              <ItemIcon className="size-4 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium">{itemMeta.label}</div>
                <div className="text-[11px] text-muted-foreground leading-snug">
                  {description}
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
