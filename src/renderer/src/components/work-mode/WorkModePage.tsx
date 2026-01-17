import { useState, useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import type { Task, WorkspaceItem, WorkspaceItemType } from '../../../../shared/types/database'
import { Button } from '@/components/ui/button'
import { WorkspaceSidebar } from './WorkspaceSidebar'

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

  const handleRenameItem = async (id: string, name: string) => {
    const updated = await window.api.workspaceItems.update({ id, name })
    setItems(items.map((i) => (i.id === id ? updated : i)))
  }

  const handleDeleteItem = async (id: string) => {
    await window.api.workspaceItems.delete(id)
    setItems(items.filter((i) => i.id !== id))
    if (activeItemId === id) setActiveItemId(null)
  }

  if (!task) return <div className="p-6">Loading...</div>

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
        <WorkspaceSidebar
          items={items}
          activeItemId={activeItemId}
          onSelectItem={setActiveItemId}
          onAddItem={handleAddItem}
          onRenameItem={handleRenameItem}
          onDeleteItem={handleDeleteItem}
        />
        <main className="flex-1 p-4">
          <p className="text-muted-foreground">Select an item</p>
        </main>
      </div>
    </div>
  )
}
