import { ListTree, Map as MapIcon } from 'lucide-react'
import { cn, Tooltip, TooltipContent, TooltipTrigger } from '@slayzone/ui'

interface MarkdownEditorTogglesProps {
  tocEnabled: boolean
  minimapEnabled: boolean
  /** Disable the minimap toggle (e.g. when in rich/preview mode where minimap is N/A). */
  minimapDisabled: boolean
  /** Tooltip override when minimap is disabled. Default: "Minimap (not available)" */
  minimapDisabledLabel?: string
  onToggleToc: () => void
  onToggleMinimap: () => void
}

export function MarkdownEditorToggles({
  tocEnabled, minimapEnabled, minimapDisabled, minimapDisabledLabel,
  onToggleToc, onToggleMinimap,
}: MarkdownEditorTogglesProps) {
  return (
    <>
      <div className="flex items-center bg-surface-1 border border-border rounded-md p-0.5 gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              aria-pressed={tocEnabled}
              className={cn(
                'flex items-center justify-center size-6 rounded transition-colors',
                tocEnabled ? 'bg-muted text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={onToggleToc}
            >
              <ListTree className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Outline</TooltipContent>
        </Tooltip>
      </div>
      <div className="flex items-center bg-surface-1 border border-border rounded-md p-0.5 gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              aria-pressed={minimapEnabled && !minimapDisabled}
              disabled={minimapDisabled}
              className={cn(
                'flex items-center justify-center size-6 rounded transition-colors',
                minimapDisabled
                  ? 'text-muted-foreground/40 cursor-not-allowed'
                  : (minimapEnabled ? 'bg-muted text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')
              )}
              onClick={onToggleMinimap}
            >
              <MapIcon className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {minimapDisabled ? (minimapDisabledLabel ?? 'Minimap (not available)') : 'Minimap'}
          </TooltipContent>
        </Tooltip>
      </div>
    </>
  )
}
