import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  cn,
} from '@slayzone/ui'
import { Check, ChevronDown, PanelLeftClose } from 'lucide-react'
import { viewRegistry, getView } from './views/registry'

interface SidebarViewSwitcherProps {
  current: string
  onChange: (id: string) => void
  compact?: boolean
  autoHide?: boolean
  onToggleAutoHide?: () => void
}

export function SidebarViewSwitcher({
  current,
  onChange,
  compact,
  autoHide,
  onToggleAutoHide,
}: SidebarViewSwitcherProps) {
  const view = getView(current)
  const Icon = view.icon

  const switcherTrigger = (
    <button
      type="button"
      aria-label={`Sidebar view: ${view.label}`}
      className={cn(
        'inline-flex items-center gap-2 rounded-md border border-border bg-muted text-muted-foreground transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        compact ? 'h-9 w-9 justify-center' : 'h-9 flex-1 px-2.5 min-w-0'
      )}
    >
      <Icon className="size-4 shrink-0" />
      {!compact && (
        <>
          <span className="truncate flex-1 text-left text-sm">{view.label}</span>
          <ChevronDown className="size-3.5 shrink-0" />
        </>
      )}
    </button>
  )

  return (
    <DropdownMenu>
      {compact ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>{switcherTrigger}</DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="right">{view.label}</TooltipContent>
        </Tooltip>
      ) : (
        <DropdownMenuTrigger asChild>{switcherTrigger}</DropdownMenuTrigger>
      )}
      <DropdownMenuContent side="top" align="start" className="min-w-[200px]">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          View
        </DropdownMenuLabel>
        {viewRegistry.map((v) => {
          const VIcon = v.icon
          const selected = v.id === current
          return (
            <DropdownMenuItem
              key={v.id}
              onSelect={() => onChange(v.id)}
              className="cursor-pointer"
            >
              <VIcon className="size-4" />
              <span>{v.label}</span>
              {selected && <Check className="size-4 col-start-3" />}
            </DropdownMenuItem>
          )
        })}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          Settings
        </DropdownMenuLabel>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault()
            onToggleAutoHide?.()
          }}
          className="cursor-pointer"
        >
          <PanelLeftClose className="size-4" />
          <span>Auto-hide</span>
          {autoHide && <Check className="size-4 col-start-3" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
