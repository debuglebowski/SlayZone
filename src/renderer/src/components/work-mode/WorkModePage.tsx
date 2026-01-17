import { useState, useEffect } from 'react'
import { ArrowLeft, MessageSquare, Globe, FileText } from 'lucide-react'
import type { Task, WorkspaceItem, WorkspaceItemType } from '../../../../shared/types/database'
import { Button } from '@/components/ui/button'
import { BrowserView } from './BrowserView'
import { DocumentEditor } from './DocumentEditor'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { WorkspaceItemCard } from './WorkspaceItemCard'

interface Props {
  taskId: string
  onBack: () => void
}

export function WorkModePage({ taskId, onBack }: Props) {
  const [task, setTask] = useState<Task | null>(null)
  const [items, setItems] = useState<WorkspaceItem[]>([])
  const [activeItemId, setActiveItemId] = useState<string | null>(null)

  useEffect(() => {
    window.api.db.getTask(taskId).then(setTask)
  }, [taskId])

  useEffect(() => {
    window.api.workspaceItems.getByTask(taskId).then(setItems)
  }, [taskId])

  const handleAddItem = async (type: WorkspaceItemType) => {
    const names = { chat: 'Chat', browser: 'New Tab', document: 'Untitled' }
    const item = await window.api.workspaceItems.create({
      taskId,
      type,
      name: names[type],
      url: type === 'browser' ? 'https://google.com' : undefined,
      content: type === 'document' ? '' : undefined
    })
    setItems([...items, item])
    setActiveItemId(item.id)
  }

  const handleDeleteItem = async (id: string) => {
    await window.api.workspaceItems.delete(id)
    setItems(items.filter((i) => i.id !== id))
    if (activeItemId === id) setActiveItemId(null)
  }

  const handleRenameItem = async (id: string, name: string) => {
    const updated = await window.api.workspaceItems.update({ id, name })
    setItems(items.map((i) => (i.id === id ? updated : i)))
  }

  const handleUrlChange = async (id: string, url: string) => {
    const updated = await window.api.workspaceItems.update({ id, url })
    setItems(items.map((i) => (i.id === id ? updated : i)))
  }

  const handleItemUpdate = (updated: WorkspaceItem) => {
    setItems(items.map((i) => (i.id === updated.id ? updated : i)))
  }

  if (!task) return <div className="p-6">Loading...</div>

  const activeItem = items.find((i) => i.id === activeItemId) ?? null

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center gap-4 p-4 border-b">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-lg font-semibold">{task.title}</h1>
        <span className="text-sm text-muted-foreground">Work Mode</span>
      </header>
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside className="w-64 border-r flex flex-col">
          <div className="p-2 border-b flex items-center justify-between">
            <span className="text-sm font-medium">Workspace</span>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleAddItem('chat')} title="Add Chat">
                <MessageSquare className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleAddItem('browser')} title="Add Browser">
                <Globe className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleAddItem('document')} title="Add Document">
                <FileText className="h-3 w-3" />
              </Button>
            </div>
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
                  onClick={() => setActiveItemId(item.id)}
                  onRename={(name) => handleRenameItem(item.id, name)}
                  onDelete={() => handleDeleteItem(item.id)}
                />
              ))
            )}
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 min-h-0">
          {!activeItem ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Select an item or add one to get started
            </div>
          ) : activeItem.type === 'chat' ? (
            <ChatPanel task={task} workspaceItemId={activeItem.id} />
          ) : activeItem.type === 'browser' ? (
            <BrowserView
              url={activeItem.url ?? 'https://google.com'}
              onUrlChange={(url) => handleUrlChange(activeItem.id, url)}
            />
          ) : activeItem.type === 'document' ? (
            <DocumentEditor item={activeItem} onUpdate={handleItemUpdate} />
          ) : null}
        </main>
      </div>
    </div>
  )
}
