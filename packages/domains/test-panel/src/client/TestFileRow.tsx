import { useState } from 'react'
import { Card, Popover, PopoverTrigger, PopoverContent, Separator } from '@slayzone/ui'
import { Check, ChevronRight } from 'lucide-react'
import type { TestLabel } from '../shared/types'

interface TestFileRowProps {
  path: string
  note: string
  fileLabels: TestLabel[]
  labels: TestLabel[]
  onToggleLabel: (labelId: string) => void
  onNoteChange: (note: string) => void
  onManageLabels: () => void
}

export function TestFileRow({ path, note, fileLabels, labels, onToggleLabel, onNoteChange, onManageLabels }: TestFileRowProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const assignedIds = new Set(fileLabels.map((l) => l.id))
  const firstLine = note.split('\n')[0]

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't toggle if clicking on popover trigger/content or the note area
    if ((e.target as HTMLElement).closest('[data-label-popover], [data-note-area]')) return
    setExpanded(!expanded)
  }

  return (
    <Card className="cursor-pointer px-3 py-2.5 gap-0" onClick={handleCardClick}>
      <div className="flex items-start gap-2">
        <ChevronRight className={`h-3 w-3 shrink-0 mt-1 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm truncate">{path}</p>
          {firstLine && !expanded && (
            <p className="text-xs text-muted-foreground truncate">{firstLine}</p>
          )}
        </div>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button className="shrink-0 flex items-center gap-1 mt-0.5" data-label-popover>
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
          <PopoverContent className="w-44 p-1" align="end" side="bottom" data-label-popover>
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
      </div>
      {expanded && (
        <div className="mt-2 ml-5 relative" data-note-area>
          {!note && (
            <p className="text-xs text-muted-foreground/50 absolute pointer-events-none">Add a note...</p>
          )}
          <div
            contentEditable
            suppressContentEditableWarning
            className="text-xs text-muted-foreground outline-none whitespace-pre-wrap min-h-4"
            onBlur={(e) => {
              const value = e.currentTarget.textContent ?? ''
              if (value !== note) onNoteChange(value)
            }}
          >
            {note}
          </div>
        </div>
      )}
    </Card>
  )
}
