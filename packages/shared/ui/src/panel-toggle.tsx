import type { LucideIcon } from 'lucide-react'

import { cn } from './utils'

interface PanelToggleItem {
  id: string
  icon: LucideIcon
  label: string
  active: boolean
  shortcut?: string
}

interface PanelToggleProps {
  panels: PanelToggleItem[]
  onChange: (id: string, active: boolean) => void
  className?: string
}

export function PanelToggle({ panels, onChange, className }: PanelToggleProps) {
  return (
    <div className={cn('flex items-center bg-muted rounded-lg p-1 gap-1', className)}>
      {panels.map((panel) => (
        <button
          key={panel.id}
          onClick={() => onChange(panel.id, !panel.active)}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
            panel.active
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <panel.icon className="size-3.5" />
          {panel.label}
          {panel.shortcut && (
            <span className={cn(
              'ml-1 text-[10px]',
              panel.active ? 'text-muted-foreground' : 'text-muted-foreground/60'
            )}>
              {panel.shortcut}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
