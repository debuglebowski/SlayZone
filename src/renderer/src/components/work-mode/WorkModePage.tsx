import { useState, useEffect } from 'react'
import { X, MessageSquare, Globe, FileText, PanelLeft, Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Task, WorkspaceItem, WorkspaceItemType } from '../../../../shared/types/database'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import { BrowserView } from './BrowserView'
import { DocumentEditor } from './DocumentEditor'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { WorkspaceItemCard } from './WorkspaceItemCard'
import { EmptyWorkspaceState } from './EmptyWorkspaceState'
import { DumperPanel } from './DumperPanel'

interface Props {
  taskId: string
  onBack: () => void
}

export function WorkModePage({ taskId, onBack }: Props) {
  const [task, setTask] = useState<Task | null>(null)
  const [items, setItems] = useState<WorkspaceItem[]>([])
  const [activeItemId, setActiveItemId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Keyboard shortcut Cmd/Ctrl+B to toggle sidebar
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'b' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setSidebarOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    window.api.db.getTask(taskId).then(setTask)
  }, [taskId])

  useEffect(() => {
    window.api.workspaceItems.getByTask(taskId).then(setItems)
  }, [taskId])

  // Auto-select first item when items are loaded and no item is selected
  useEffect(() => {
    if (items.length > 0 && activeItemId === null) {
      setActiveItemId(items[0].id)
    }
  }, [items, activeItemId])

  const handleAddItem = async (type: WorkspaceItemType) => {
    const names = { chat: 'Chat', browser: 'New Tab', document: 'Untitled', dumper: 'Thought Dump' }
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
    <div className="flex h-screen relative">
      {/* Sidebar */}
      <aside
        className={cn(
          'border-r flex flex-col transition-all duration-200',
          sidebarOpen ? 'w-80' : 'w-0 overflow-hidden'
        )}
      >
        {/* Draggable region for window movement - clears traffic lights */}
        <div className="h-10 window-drag-region shrink-0" />
        {/* Title */}
        <div className="flex items-center justify-between p-4 pt-0 border-b">
          <h1 className="text-lg font-semibold truncate pr-2">{task.title}</h1>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              onClick={() => setSidebarOpen(false)}
              title="Hide sidebar (⌘B)"
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              onClick={onBack}
            >
              <X className="h-4 w-4" />
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
        <div className="border-t p-2 flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className="h-10 flex-1"
                onClick={() => handleAddItem('chat')}
              >
                <MessageSquare className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add Chat</TooltipContent>
          </Tooltip>
          <Separator orientation="vertical" className="h-5" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className="h-10 flex-1"
                onClick={() => handleAddItem('browser')}
              >
                <Globe className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add Browser</TooltipContent>
          </Tooltip>
          <Separator orientation="vertical" className="h-5" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className="h-10 flex-1"
                onClick={() => handleAddItem('document')}
              >
                <FileText className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add Document</TooltipContent>
          </Tooltip>
          <Separator orientation="vertical" className="h-5" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className="h-10 flex-1"
                onClick={() => handleAddItem('dumper')}
              >
                <Lightbulb className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add Thought Dumper</TooltipContent>
          </Tooltip>
        </div>
      </aside>

      {/* Sidebar toggle when collapsed */}
      {!sidebarOpen && (
        <>
          {/* Draggable region when sidebar is hidden */}
          <div className="absolute top-0 left-0 right-0 h-10 window-drag-region z-5" />
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-2 top-12 h-7 w-7 text-muted-foreground z-10 window-no-drag"
            onClick={() => setSidebarOpen(true)}
            title="Show sidebar (⌘B)"
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
        </>
      )}

      {/* Content */}
      {items.length === 0 ? (
        <EmptyWorkspaceState onAddItem={handleAddItem} />
      ) : !activeItem ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          Select an item to get started
        </div>
      ) : (
        <main className="flex-1 min-h-0">
          {activeItem.type === 'chat' ? (
            <ChatPanel task={task} workspaceItemId={activeItem.id} />
          ) : activeItem.type === 'browser' ? (
            <BrowserView
              url={activeItem.url ?? 'https://google.com'}
              onUrlChange={(url) => handleUrlChange(activeItem.id, url)}
            />
          ) : activeItem.type === 'document' ? (
            <DocumentEditor item={activeItem} onUpdate={handleItemUpdate} />
          ) : activeItem.type === 'dumper' ? (
            <DumperPanel item={activeItem} onUpdate={handleItemUpdate} />
          ) : null}
        </main>
      )}
    </div>
  )
}
