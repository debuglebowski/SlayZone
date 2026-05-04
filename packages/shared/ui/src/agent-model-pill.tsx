import { ChevronDown, Sparkles } from 'lucide-react'
import { cn } from './utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu'

export type AgentModel = 'default' | 'sonnet' | 'opus' | 'haiku'

interface ModelMeta {
  label: string
  short: string
  description: string
}

const MODEL_META: Record<AgentModel, ModelMeta> = {
  default: {
    label: 'Default model',
    short: 'Default',
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

const MODEL_ORDER: AgentModel[] = ['default', 'sonnet', 'opus', 'haiku']

export interface AgentModelPillProps {
  model: AgentModel
  onChange: (next: AgentModel) => void
  disabled?: boolean
  compact?: boolean
  className?: string
}

export function AgentModelPill({ model, onChange, disabled, compact, className }: AgentModelPillProps) {
  const meta = MODEL_META[model]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full ring-1 px-2 py-0.5 text-[11px] font-medium transition-colors',
          'bg-muted/40 text-muted-foreground ring-border hover:bg-muted/60 hover:text-foreground',
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
