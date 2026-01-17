import { useState, useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import type { Task } from '../../../../shared/types/database'
import { Button } from '@/components/ui/button'

interface Props {
  taskId: string
  onBack: () => void
}

export function WorkModePage({ taskId, onBack }: Props) {
  const [task, setTask] = useState<Task | null>(null)

  useEffect(() => {
    window.api.db.getTask(taskId).then(setTask)
  }, [taskId])

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
        <aside className="w-64 border-r p-4">
          <p className="text-sm text-muted-foreground">Workspace items</p>
        </aside>
        <main className="flex-1 p-4">
          <p className="text-muted-foreground">Select an item</p>
        </main>
      </div>
    </div>
  )
}
