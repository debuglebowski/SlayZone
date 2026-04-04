import { GitBranch, List } from 'lucide-react'
import { cn } from '@slayzone/ui'

export type SkillViewMode = 'graph' | 'list'

interface SkillViewToggleProps {
  value: SkillViewMode
  onChange: (mode: SkillViewMode) => void
  className?: string
}

export function SkillViewToggle({ value, onChange, className }: SkillViewToggleProps) {
  return (
    <div className={cn('flex items-center gap-0.5 rounded-md bg-muted p-0.5', className)}>
      <button
        onClick={() => onChange('graph')}
        className={cn(
          'flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors',
          value === 'graph'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <GitBranch className="size-3" />
        Graph
      </button>
      <button
        onClick={() => onChange('list')}
        className={cn(
          'flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors',
          value === 'list'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <List className="size-3" />
        List
      </button>
    </div>
  )
}
