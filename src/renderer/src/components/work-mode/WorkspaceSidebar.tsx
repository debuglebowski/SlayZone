import { Plus, MessageSquare, Globe, FileText } from 'lucide-react'
import type { WorkspaceItem, WorkspaceItemType } from '../../../../shared/types/database'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { WorkspaceItemCard } from './WorkspaceItemCard'

interface Props {
  items: WorkspaceItem[]
  activeItemId: string | null
  onSelectItem: (id: string) => void
  onAddItem: (type: WorkspaceItemType) => void
  onRenameItem: (id: string, name: string) => void
  onDeleteItem: (id: string) => void
}

export function WorkspaceSidebar({
  items,
  activeItemId,
  onSelectItem,
  onAddItem,
  onRenameItem,
  onDeleteItem
}: Props) {
  return (
    <aside className="w-64 border-r flex flex-col">
      <div className="p-2 border-b flex items-center justify-between">
        <span className="text-sm font-medium">Workspace</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <Plus className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onAddItem('chat')}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Chat
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAddItem('browser')}>
              <Globe className="h-4 w-4 mr-2" />
              Browser Tab
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAddItem('document')}>
              <FileText className="h-4 w-4 mr-2" />
              Document
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No items yet</p>
        ) : (
          items.map((item) => (
            <WorkspaceItemCard
              key={item.id}
              item={item}
              isActive={item.id === activeItemId}
              onClick={() => onSelectItem(item.id)}
              onRename={(name) => onRenameItem(item.id, name)}
              onDelete={() => onDeleteItem(item.id)}
            />
          ))
        )}
      </div>
    </aside>
  )
}
