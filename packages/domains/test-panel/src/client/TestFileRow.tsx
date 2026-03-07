import { useState } from 'react'
import { Card, Popover, PopoverTrigger, PopoverContent, Separator } from '@slayzone/ui'
import { Check } from 'lucide-react'
import type { TestLabel } from '../shared/types'

interface TestFileRowProps {
  path: string
  fileLabels: TestLabel[]
  labels: TestLabel[]
  onToggleLabel: (labelId: string) => void
  onManageLabels: () => void
}

export function TestFileRow({ path, fileLabels, labels, onToggleLabel, onManageLabels }: TestFileRowProps): React.JSX.Element {
  const [open, setOpen] = useState(false)

  const assignedIds = new Set(fileLabels.map((l) => l.id))

  return (
    <Card className="cursor-default px-3 py-2.5 flex-row items-center gap-2">
      <p className="text-sm truncate flex-1">{path}</p>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button className="shrink-0 flex items-center gap-1">
            {fileLabels.length > 0 ? (
              fileLabels.map((l) => (
                <span
                  key={l.id}
                  className="text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: l.color + '20', color: l.color }}
                >
                  {l.name}
                </span>
              ))
            ) : (
              <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full border border-dashed border-muted-foreground/30 hover:border-muted-foreground/60 transition-colors">
                +
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-44 p-1" align="end" side="bottom">
          <div className="space-y-0.5">
            {labels.map((l) => (
              <button
                key={l.id}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm hover:bg-muted/50 transition-colors"
                onClick={() => onToggleLabel(l.id)}
              >
                <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
                <span className="truncate">{l.name}</span>
                {assignedIds.has(l.id) && <Check className="ml-auto h-3 w-3 text-muted-foreground" />}
              </button>
            ))}
            <Separator className="my-1" />
            <button
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm hover:bg-muted/50 transition-colors text-muted-foreground"
              onClick={() => { onManageLabels(); setOpen(false) }}
            >
              Manage Labels...
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </Card>
  )
}
