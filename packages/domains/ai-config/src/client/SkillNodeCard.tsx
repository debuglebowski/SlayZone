import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@slayzone/ui'
import type { AiConfigItem, AiConfigScope, SkillValidationStatus } from '../shared'

export interface SkillNodeData {
  item: AiConfigItem
  scope: AiConfigScope
  validationStatus: SkillValidationStatus | null
  description: string
  selected: boolean
  [key: string]: unknown
}

export const SkillNodeCard = memo(function SkillNodeCard({ data }: NodeProps) {
  const { item, scope, validationStatus, description, selected } = data as SkillNodeData

  return (
    <div
      className={cn(
        'w-[220px] rounded-lg border bg-background px-3 py-2.5 shadow-sm transition-shadow',
        selected ? 'ring-2 ring-primary border-primary shadow-md' : 'hover:shadow-md'
      )}
    >
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-muted-foreground/50 !border-none" />

      <div className="flex items-start justify-between gap-1.5">
        <p className="truncate font-mono text-sm font-medium leading-tight">{item.slug}</p>
        <div className="flex shrink-0 items-center gap-1">
          {validationStatus && validationStatus !== 'valid' && (
            <AlertTriangle className={cn(
              'size-3.5',
              validationStatus === 'invalid' ? 'text-destructive' : 'text-amber-500'
            )} />
          )}
          <span className={cn(
            'rounded px-1 py-0.5 text-[9px] font-medium uppercase leading-none',
            scope === 'global'
              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          )}>
            {scope === 'global' ? 'G' : 'P'}
          </span>
        </div>
      </div>

      {description && (
        <p className="mt-1 line-clamp-2 text-[11px] leading-tight text-muted-foreground">
          {description}
        </p>
      )}

      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-muted-foreground/50 !border-none" />
    </div>
  )
})
