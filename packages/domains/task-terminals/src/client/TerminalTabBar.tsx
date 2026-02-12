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
  rightContent?: React.ReactNode
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
  onTabRename,
  rightContent
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
    <div
      data-testid="terminal-tabbar"
      className="flex items-center h-10 px-2 bg-neutral-100 border-b border-neutral-200 dark:bg-transparent dark:border-border"
    >
      <div className="flex items-center gap-1 min-w-0 overflow-x-auto scrollbar-hide">
        {tabs.map(tab => {
          const Icon = MODE_ICONS[tab.mode]
          const isActive = tab.id === activeTabId
          const isEditing = editingTabId === tab.id

          return (
            <div
              key={tab.id}
              data-testid={`terminal-tab-${tab.id}`}
              data-tab-id={tab.id}
              data-tab-mode={tab.mode}
              data-tab-main={tab.isMain ? 'true' : 'false'}
              data-tab-active={isActive ? 'true' : 'false'}
              className={cn(
                'group flex items-center gap-1.5 h-7 px-3 rounded-md cursor-pointer transition-colors select-none shrink-0',
                'hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50',
                isActive
                  ? 'bg-neutral-200 dark:bg-neutral-800'
                  : 'text-neutral-500 dark:text-neutral-400'
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
                  data-testid={`terminal-tab-close-${tab.id}`}
                  className="h-4 w-4 rounded hover:bg-neutral-300/50 dark:hover:bg-neutral-600/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
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
          data-testid="terminal-tab-add"
          className="flex items-center justify-center h-7 w-7 rounded-md text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200/50 dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:bg-neutral-800/50 shrink-0"
          onClick={onTabCreate}
        >
          <Plus className="size-4" />
        </button>
      </div>
      {rightContent && (
        <div className="ml-auto flex items-center shrink-0 pl-2">
          {rightContent}
        </div>
      )}
    </div>
  )
}
