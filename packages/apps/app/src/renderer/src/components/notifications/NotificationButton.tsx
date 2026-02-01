import { Bell } from 'lucide-react'
import { cn, Tooltip, TooltipTrigger, TooltipContent } from '@omgslayzone/ui'

interface NotificationButtonProps {
  active: boolean
  onClick: () => void
}

export function NotificationButton({ active, onClick }: NotificationButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            'h-7 w-7 flex items-center justify-center transition-colors border-b-2',
            active
              ? 'text-foreground border-foreground'
              : 'text-muted-foreground border-transparent hover:text-foreground'
          )}
        >
          <Bell className="size-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {active ? 'Hide notifications panel' : 'Show notifications panel'}
      </TooltipContent>
    </Tooltip>
  )
}
