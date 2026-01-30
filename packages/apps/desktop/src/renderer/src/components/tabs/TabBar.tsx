import { Home, X } from 'lucide-react'
import { cn } from '@omgslayzone/ui'

export type Tab = { type: 'home' } | { type: 'task'; taskId: string; title: string }

interface TabBarProps {
  tabs: Tab[]
  activeIndex: number
  onTabClick: (index: number) => void
  onTabClose: (index: number) => void
}

export function TabBar({ tabs, activeIndex, onTabClick, onTabClose }: TabBarProps): React.JSX.Element {
  return (
    <div className="flex items-end h-9 pl-2 pr-2 gap-1 bg-background border-b overflow-x-auto">
      {tabs.map((tab, i) => {
        const isActive = i === activeIndex
        const isHome = tab.type === 'home'

        return (
          <div
            key={isHome ? 'home' : tab.taskId}
            className={cn(
              'flex items-center gap-1.5 h-8 px-3 rounded-t-md cursor-pointer transition-colors select-none',
              'hover:bg-muted/50',
              isActive ? 'bg-muted border-b-2 border-b-primary' : 'text-muted-foreground',
              !isHome && 'min-w-[150px] max-w-[300px]'
            )}
            onClick={() => onTabClick(i)}
            onAuxClick={(e) => {
              if (e.button === 1 && !isHome) {
                e.preventDefault()
                onTabClose(i)
              }
            }}
          >
            {isHome ? (
              <Home className="h-4 w-4" />
            ) : (
              <>
                <span className="truncate text-sm">{tab.title}</span>
                <button
                  className="h-4 w-4 rounded hover:bg-muted-foreground/20 flex items-center justify-center"
                  onClick={(e) => {
                    e.stopPropagation()
                    onTabClose(i)
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
