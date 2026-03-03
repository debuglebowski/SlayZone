import { cn } from './utils'

interface SettingsLayoutItem {
  key: string
  label: string
  children?: SettingsLayoutItem[]
}

interface SettingsLayoutProps {
  items: SettingsLayoutItem[]
  activeKey: string
  onSelect: (key: string) => void
  children: React.ReactNode
  className?: string
}

export function SettingsLayout({
  items,
  activeKey,
  onSelect,
  children,
  className
}: SettingsLayoutProps): React.JSX.Element {
  return (
    <div className={cn('grid h-[calc(88vh-76px)] grid-cols-[280px_minmax(0,1fr)]', className)}>
      <aside className="overflow-y-auto border-r p-5">
        <div className="space-y-1.5 rounded-xl p-2.5">
          {items.map((item) => {
            const isParentActive = activeKey === item.key || (item.children && activeKey.startsWith(item.key + '/'))
            return (
              <div key={item.key}>
                <button
                  onClick={() => onSelect(item.key)}
                  data-testid={`settings-tab-${item.key}`}
                  className={cn(
                    'w-full rounded-md px-3.5 py-2.5 text-left text-sm font-medium transition-colors',
                    isParentActive && activeKey === item.key
                      ? 'bg-accent text-foreground shadow-sm'
                      : isParentActive
                        ? 'text-foreground'
                        : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                  )}
                >
                  {item.label}
                </button>
                {item.children && (
                  <div className="ml-3 mt-0.5 space-y-0.5 pl-2.5">
                    {item.children.map((child) => (
                      <button
                        key={child.key}
                        onClick={() => onSelect(child.key)}
                        data-testid={`settings-tab-${child.key}`}
                        className={cn(
                          'w-full rounded-md px-3.5 py-2.5 text-left text-sm font-medium transition-colors',
                          activeKey === child.key
                            ? 'bg-accent text-foreground shadow-sm'
                            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                        )}
                      >
                        {child.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </aside>

      <main className="overflow-y-auto px-8 py-6">{children}</main>
    </div>
  )
}
