import type { ReactNode } from 'react'
import { Collapsible, CollapsibleContent, TooltipProvider } from '@slayzone/ui'

interface MarkdownSettingsBannerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}

export function MarkdownSettingsBanner({ open, onOpenChange, children }: MarkdownSettingsBannerProps) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleContent>
        <TooltipProvider delayDuration={400}>
          <div className="flex flex-wrap items-center justify-end gap-4 px-3 py-2 border-b border-border bg-surface-1">
            {children}
          </div>
        </TooltipProvider>
      </CollapsibleContent>
    </Collapsible>
  )
}
