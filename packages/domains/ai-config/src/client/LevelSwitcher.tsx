import { Monitor, FolderGit2, Library } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, cn } from '@slayzone/ui'
import type { ConfigLevel } from '../shared'

interface LevelSwitcherProps {
  value: ConfigLevel
  onChange: (level: ConfigLevel) => void
  hasProject: boolean
  layout?: 'tabs' | 'pills' | 'sidebar'
  className?: string
}

const LEVELS: { id: ConfigLevel; label: string; icon: typeof Monitor }[] = [
  { id: 'computer', label: 'Computer', icon: Monitor },
  { id: 'project', label: 'Project', icon: FolderGit2 },
  { id: 'library', label: 'Library', icon: Library },
]

export function LevelSwitcher({ value, onChange, hasProject, layout = 'tabs', className }: LevelSwitcherProps) {
  if (layout === 'pills') {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        {LEVELS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            disabled={id === 'project' && !hasProject}
            onClick={() => onChange(id)}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors',
              value === id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              id === 'project' && !hasProject && 'pointer-events-none opacity-40'
            )}
          >
            <Icon className="size-3" />
            {label}
          </button>
        ))}
      </div>
    )
  }

  if (layout === 'sidebar') {
    return (
      <nav className={cn('space-y-1', className)}>
        {LEVELS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            disabled={id === 'project' && !hasProject}
            onClick={() => onChange(id)}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              value === id
                ? 'bg-surface-2 text-foreground'
                : 'text-muted-foreground hover:bg-surface-1 hover:text-foreground',
              id === 'project' && !hasProject && 'pointer-events-none opacity-40'
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </nav>
    )
  }

  // Default: tabs
  return (
    <Tabs
      value={value}
      onValueChange={(v) => onChange(v as ConfigLevel)}
      className={className}
    >
      <TabsList className="h-7">
        {LEVELS.map(({ id, label, icon: Icon }) => (
          <TabsTrigger
            key={id}
            value={id}
            disabled={id === 'project' && !hasProject}
            className="text-xs px-2 h-6 gap-1"
          >
            <Icon className="size-3" />
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
