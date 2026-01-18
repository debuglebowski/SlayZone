import { useState, useEffect } from 'react'
import { Sparkles, Globe, FileText, MoreVertical, Lightbulb } from 'lucide-react'
import type { WorkspaceItem } from '../../../../shared/types/database'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface Props {
  item: WorkspaceItem
  index?: number
  isActive: boolean
  onClick: () => void
  onRename: (name: string) => void
  onDelete: () => void
}

const typeIcons = {
  chat: Sparkles,
  browser: Globe,
  document: FileText,
  dumper: Lightbulb
}

function getHostname(url: string): string | null {
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

export function WorkspaceItemCard({ item, index, isActive, onClick, onRename, onDelete }: Props) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(item.name)
  const [faviconError, setFaviconError] = useState(false)
  const Icon = typeIcons[item.type]

  // Reset favicon error state when URL changes
  useEffect(() => {
    setFaviconError(false)
  }, [item.url])

  // Use DuckDuckGo's favicon service (no redirects, CSP-friendly)
  const hostname = item.type === 'browser' && item.url ? getHostname(item.url) : null
  const faviconUrl = hostname ? `https://icons.duckduckgo.com/ip3/${hostname}.ico` : null
  const showFavicon = faviconUrl && !faviconError

  const handleRename = () => {
    if (name.trim() && name !== item.name) {
      onRename(name.trim())
    }
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleRename()
    if (e.key === 'Escape') {
      setName(item.name)
      setEditing(false)
    }
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer group',
        isActive ? 'bg-accent' : 'hover:bg-muted'
      )}
      onClick={editing ? undefined : onClick}
    >
      {index !== undefined && index < 9 && (
        <span className="text-xs text-muted-foreground/50 w-3 shrink-0 text-center tabular-nums">
          {index + 1}
        </span>
      )}
      {showFavicon ? (
        <img
          src={faviconUrl}
          alt=""
          className="h-4 w-4 shrink-0"
          onError={() => setFaviconError(true)}
        />
      ) : (
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}
      {editing ? (
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleRename}
          onKeyDown={handleKeyDown}
          className="h-6 text-sm"
          autoFocus
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="flex-1 truncate text-sm">{item.name}</span>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
            <MoreVertical className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditing(true)}>Rename</DropdownMenuItem>
          <DropdownMenuItem onClick={onDelete} className="text-destructive">
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
