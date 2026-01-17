import { MessageSquare, Globe, FileText } from 'lucide-react'
import type { WorkspaceItem, WorkspaceItemType } from '../../../../shared/types/database'
import { Button } from '@/components/ui/button'

interface Props {
  items: WorkspaceItem[]
  activeItemId: string | null
  onSelectItem: (id: string) => void
  onAddItem: (type: WorkspaceItemType) => void
  onRenameItem: (id: string, name: string) => void
  onDeleteItem: (id: string) => void
}

const typeIcons = {
  chat: MessageSquare,
  browser: Globe,
  document: FileText
}

export function WorkspaceSidebar({
  items,
  activeItemId,
  onSelectItem,
  onAddItem,
  onRenameItem: _onRenameItem,
  onDeleteItem
}: Props) {
  void _onRenameItem // Reserved for inline rename feature
  return (
    <aside className="w-64 border-r flex flex-col">
      <div className="p-2 border-b flex items-center justify-between">
        <span className="text-sm font-medium">Workspace</span>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onAddItem('chat')}
            title="Add Chat"
          >
            <MessageSquare className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onAddItem('browser')}
            title="Add Browser"
          >
            <Globe className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onAddItem('document')}
            title="Add Document"
          >
            <FileText className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No items yet</p>
        ) : (
          items.map((item) => {
            const Icon = typeIcons[item.type]
            return (
              <div
                key={item.id}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer group ${
                  item.id === activeItemId ? 'bg-accent' : 'hover:bg-muted'
                }`}
                onClick={() => onSelectItem(item.id)}
              >
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-sm">{item.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteItem(item.id)
                  }}
                  title="Delete"
                >
                  <span className="text-xs">×</span>
                </Button>
              </div>
            )
          })
        )}
      </div>
    </aside>
  )
}
