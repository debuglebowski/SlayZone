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
  // Gate hover-driven selection until the mouse actually moves. The menu can
  // materialize under a stationary pointer, which fires synthetic mouseenter
  // without real motion — that should not override the default index.
  const armedRef = useRef(false)

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${selectedIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  useEffect(() => {
    armedRef.current = false
    const el = listRef.current
    if (!el) return
    const handler = () => {
      armedRef.current = true
    }
    el.addEventListener('mousemove', handler, { once: true })
    return () => el.removeEventListener('mousemove', handler)
  }, [active.leadSourceId, active.match.tokenStart, active.match.query])

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
            onMouseEnter={() => {
              if (armedRef.current) onHover(i)
            }}
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
