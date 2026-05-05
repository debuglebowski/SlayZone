import { ChevronDown, Sparkles } from 'lucide-react'
import { cn } from './utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu'

export type AgentModel = 'default' | 'sonnet' | 'opus' | 'haiku'
export type ResolvedAgentModel = Exclude<AgentModel, 'default'>

interface ModelMeta {
  label: string
  short: string
  description: string
}

const MODEL_META: Record<AgentModel, ModelMeta> = {
  default: {
    label: 'Default model',
    short: 'Default model',
    description: 'Inherit Claude account default. No --model flag.',
  },
  sonnet: {
    label: 'Sonnet',
    short: 'Sonnet',
    description: 'Balanced speed + capability. Recommended for most chats.',
  },
  opus: {
    label: 'Opus',
    short: 'Opus',
    description: 'Maximum capability. Slower, higher cost.',
  },
  haiku: {
    label: 'Haiku',
    short: 'Haiku',
    description: 'Fastest + cheapest. Best for simple tasks.',
  },
}

const RESOLVED_LABEL: Record<ResolvedAgentModel, string> = {
  sonnet: 'Sonnet',
  opus: 'Opus',
  haiku: 'Haiku',
}

const MODEL_ORDER: AgentModel[] = ['default', 'sonnet', 'opus', 'haiku']

export interface AgentModelPillProps {
  model: AgentModel
  onChange: (next: AgentModel) => void
  disabled?: boolean
  compact?: boolean
  /** Visual style. `pill` = chip (default). `text` = plain inline text. */
  variant?: 'pill' | 'text'
  className?: string
  /** Resolved value of "Default" — read from `~/.claude/settings.json`. When
   * provided, dropdown row for `default` shows ` → Opus` (or matching label). */
  accountDefaultModel?: ResolvedAgentModel | null
}

export function AgentModelPill({ model, onChange, disabled, compact, variant = 'pill', className, accountDefaultModel }: AgentModelPillProps) {
  const meta = MODEL_META[model]
  const defaultDescSuffix = accountDefaultModel
    ? ` → ${RESOLVED_LABEL[accountDefaultModel]}.`
    : ''
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className={cn(
          'inline-flex items-center transition-colors',
          variant === 'pill'
            ? 'gap-1.5 rounded-full ring-1 px-2 py-0.5 text-[11px] font-medium bg-muted/40 text-muted-foreground ring-border hover:bg-muted/60 hover:text-foreground'
            : 'gap-1 rounded px-1 py-0.5 text-[10px] text-muted-foreground/80 hover:bg-muted/60 hover:text-foreground',
          disabled && 'opacity-50 cursor-not-allowed',
          className,
        )}
        title={meta.description}
        aria-label={`Chat model: ${meta.label}`}
      >
        <Sparkles className="size-3" />
        <span>{compact ? meta.short : meta.label}</span>
        <ChevronDown className="size-3 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {MODEL_ORDER.map((m) => {
          const itemMeta = MODEL_META[m]
          const selected = m === model
          const description =
            m === 'default' ? `${itemMeta.description}${defaultDescSuffix}` : itemMeta.description
          return (
            <DropdownMenuItem
              key={m}
              onSelect={(e) => {
                if (m === model) {
                  e.preventDefault()
                  return
                }
                onChange(m)
              }}
              className={cn('flex items-start gap-2 py-2', selected && 'bg-accent/40')}
            >
              <Sparkles className="size-4 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium">{itemMeta.label}</div>
                <div className="text-[11px] text-muted-foreground leading-snug">
                  {description}
                </div>
              </div>
              {selected && (
                <span className="self-center rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  current
                </span>
              )}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
