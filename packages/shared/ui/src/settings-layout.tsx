import { cn } from './utils'

interface SettingsLayoutItem {
  key: string
  label: string
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
        <div className="space-y-1.5 rounded-xl bg-muted/40 p-2.5">
          {items.map((item) => (
            <button
              key={item.key}
              onClick={() => onSelect(item.key)}
              className={cn(
                'w-full rounded-md px-3.5 py-2.5 text-left text-sm font-medium transition-colors',
                activeKey === item.key
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </aside>

      <main className="overflow-y-auto px-8 py-6">{children}</main>
    </div>
  )
}
