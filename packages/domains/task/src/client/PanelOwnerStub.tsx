import type { LucideIcon } from 'lucide-react'
import { Button, Tooltip, TooltipTrigger, TooltipContent } from '@slayzone/ui'

interface Props {
  panelLabel: string
  icon?: LucideIcon
  /** True iff another live window owns this panel. */
  activeElsewhere: boolean
  /** Claim ownership for the current window (other window keeps toggle on, swaps to stub) */
  onActivate: () => void
  /** Claim + force-close the panel in the previous owner window (no DB write) */
  onActivateAndClose?: () => void
  /** True if multi-window support not yet wired (terminal/browser/web until PR3/PR4) */
  unsupported?: boolean
}

export function PanelOwnerStub({ panelLabel, icon: Icon, activeElsewhere, onActivate, onActivateAndClose, unsupported }: Props) {
  if (unsupported) {
    return (
      <div className="h-full w-full flex items-center justify-center p-6">
        <div className="max-w-sm text-center space-y-3">
          {Icon && <Icon className="size-10 text-muted-foreground/60 mx-auto" />}
          <div className="text-sm font-medium text-muted-foreground">{panelLabel} not yet supported in this window</div>
          <div className="text-xs text-muted-foreground/70">
            Multi-window support for {panelLabel.toLowerCase()} is coming soon. Use the primary window for now.
          </div>
        </div>
      </div>
    )
  }
  if (!activeElsewhere) return null
  return (
    <div className="h-full w-full flex items-center justify-center p-6">
      <div className="max-w-sm text-center space-y-3">
        {Icon && <Icon className="size-10 text-muted-foreground/60 mx-auto" />}
        <div className="text-sm font-medium text-muted-foreground">{panelLabel} active in other window</div>
        <div className="flex items-center justify-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="outline" onClick={onActivate}>Take over</Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Show {panelLabel.toLowerCase()} here. Other window keeps the toggle on but shows a stub.</TooltipContent>
          </Tooltip>
          {onActivateAndClose && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" onClick={onActivateAndClose}>Take over and close</Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Show {panelLabel.toLowerCase()} here AND close it in the other window.</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  )
}
