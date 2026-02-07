import { useState, useRef, useEffect } from 'react'
import { Plus, X, Terminal as TerminalIcon, Bot, Command } from 'lucide-react'
import { cn } from '@slayzone/ui'
import type { TerminalTab } from '../shared/types'
import type { TerminalMode } from '@slayzone/terminal/shared'

interface TerminalTabBarProps {
  tabs: TerminalTab[]
  activeTabId: string
  onTabSelect: (tabId: string) => void
  onTabCreate: () => void
  onTabClose: (tabId: string) => void
  onTabRename: (tabId: string, label: string | null) => void
}

const MODE_ICONS: Record<TerminalMode, typeof TerminalIcon> = {
  'claude-code': Bot,
  'codex': Command,
  'terminal': TerminalIcon
}

export function TerminalTabBar({
  tabs,
  activeTabId,
  onTabSelect,
  onTabCreate,
  onTabClose,
  onTabRename
}: TerminalTabBarProps) {
  const [editingTabId, setEditingTabId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingTabId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingTabId])

  const handleDoubleClick = (tab: TerminalTab) => {
    if (tab.isMain) return // Can't rename main tab
    setEditingTabId(tab.id)
    setEditValue(tab.label || '')
  }

  const handleRenameSubmit = (tabId: string) => {
    onTabRename(tabId, editValue.trim() || null)
    setEditingTabId(null)
  }

  const getTabLabel = (tab: TerminalTab): string => {
    if (tab.label) return tab.label
    if (tab.isMain) {
      switch (tab.mode) {
        case 'claude-code': return 'Claude Code'
        case 'codex': return 'Codex'
        default: return 'Terminal'
      }
    }
    return 'Terminal'
  }

  return (
    <div className="flex items-end h-11 pt-2 px-2 gap-1 bg-neutral-950 border-b border-neutral-800 overflow-x-auto">
      {tabs.map(tab => {
        const Icon = MODE_ICONS[tab.mode]
        const isActive = tab.id === activeTabId
        const isEditing = editingTabId === tab.id

        return (
          <div
            key={tab.id}
            className={cn(
              'group flex items-center gap-1.5 h-8 px-3 rounded-t-md cursor-pointer transition-colors select-none shrink-0',
              'hover:bg-neutral-800/50',
              isActive
                ? 'bg-neutral-800 border-b-2 border-b-white'
                : 'text-neutral-400'
            )}
            onClick={() => onTabSelect(tab.id)}
            onDoubleClick={() => handleDoubleClick(tab)}
          >
            <Icon className="size-3.5 shrink-0" />
            {isEditing ? (
              <input
                ref={inputRef}
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={() => handleRenameSubmit(tab.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleRenameSubmit(tab.id)
                  if (e.key === 'Escape') setEditingTabId(null)
                }}
                className="w-20 bg-transparent border-none outline-none text-xs"
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span className="truncate text-sm">{getTabLabel(tab)}</span>
            )}
            {tab.isMain ? (
              <span className="ml-auto text-[10px] text-orange-300/80 bg-orange-400/10 px-1.5 rounded-full">main</span>
            ) : (
              <button
                className="h-4 w-4 rounded hover:bg-neutral-600/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={e => {
                  e.stopPropagation()
                  onTabClose(tab.id)
                }}
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        )
      })}
      <button
        className="flex items-center justify-center h-8 w-8 rounded-t-md text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50 shrink-0"
        onClick={onTabCreate}
      >
        <Plus className="size-4" />
      </button>
    </div>
  )
}
