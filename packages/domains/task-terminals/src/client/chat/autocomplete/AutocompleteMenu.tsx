import { useEffect, useRef } from 'react'
import { cn } from '@slayzone/ui'
import type { ActiveMatch } from './useAutocomplete'

export interface AutocompleteMenuProps {
  active: ActiveMatch
  selectedIndex: number
  onSelect: (index: number) => void
  onHover: (index: number) => void
}

export function AutocompleteMenu(props: AutocompleteMenuProps) {
  const { active, selectedIndex, onSelect, onHover } = props
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${selectedIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  return (
    <div
      ref={listRef}
      className="absolute bottom-full left-0 right-0 mb-2 max-h-64 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg z-10"
      role="listbox"
      data-source={active.leadSourceId}
    >
      {active.entries.map((entry, i) => {
        const selected = i === selectedIndex
        const key = `${entry.source.id}:${entry.source.getKey(entry.item)}`
        return (
          <div
            key={key}
            data-idx={i}
            data-source={entry.source.id}
            role="option"
            aria-selected={selected}
            onMouseDown={(e) => {
              e.preventDefault()
              onSelect(i)
            }}
            onMouseEnter={() => onHover(i)}
            className={cn(
              'px-3 py-2 cursor-pointer text-sm',
              selected && 'bg-accent text-accent-foreground'
            )}
          >
            {entry.source.render(entry.item, selected)}
          </div>
        )
      })}
    </div>
  )
}
