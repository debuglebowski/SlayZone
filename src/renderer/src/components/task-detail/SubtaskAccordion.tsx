import { useState, useEffect } from 'react'
import { ChevronRight, Plus } from 'lucide-react'
import type { Task } from '../../../../shared/types/database'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { SubtaskItem } from './SubtaskItem'
import { cn } from '@/lib/utils'

interface SubtaskAccordionProps {
  parentTaskId: string
  projectId: string
}

export function SubtaskAccordion({
  parentTaskId,
  projectId
}: SubtaskAccordionProps): React.JSX.Element {
  const [subtasks, setSubtasks] = useState<Task[]>([])
  const [expanded, setExpanded] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [loading, setLoading] = useState(true)

  // Load subtasks on mount
  useEffect(() => {
    const loadSubtasks = async (): Promise<void> => {
      const loaded = await window.api.db.getSubtasks(parentTaskId)
      setSubtasks(loaded)
      setExpanded(loaded.length > 0)
      setLoading(false)
    }

    loadSubtasks()
  }, [parentTaskId])

  const handleAddSubtask = async (): Promise<void> => {
    if (!newTitle.trim()) return

    const created = await window.api.db.createTask({
      projectId,
      parentId: parentTaskId,
      title: newTitle.trim()
    })

    setSubtasks((prev) => [...prev, created])
    setNewTitle('')
    setExpanded(true)
  }

  const handleKeyDown = async (
    e: React.KeyboardEvent<HTMLInputElement>
  ): Promise<void> => {
    if (e.key === 'Enter') {
      await handleAddSubtask()
    }
  }

  const handleSubtaskUpdate = (updated: Task): void => {
    setSubtasks((prev) =>
      prev.map((s) => (s.id === updated.id ? updated : s))
    )
  }

  const handleSubtaskDelete = (subtaskId: string): void => {
    setSubtasks((prev) => prev.filter((s) => s.id !== subtaskId))
  }

  const doneCount = subtasks.filter((s) => s.status === 'done').length

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading...</div>
  }

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-start gap-2 px-0">
          <ChevronRight
            className={cn(
              'size-4 transition-transform',
              expanded && 'rotate-90'
            )}
          />
          <span className="font-medium">
            Subtasks ({subtasks.length})
            {subtasks.length > 0 && (
              <span className="ml-1 text-muted-foreground">
                - {doneCount} done
              </span>
            )}
          </span>
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="pl-6">
        {/* Subtask list */}
        <div className="space-y-1">
          {subtasks.map((subtask) => (
            <SubtaskItem
              key={subtask.id}
              subtask={subtask}
              onUpdate={handleSubtaskUpdate}
              onDelete={handleSubtaskDelete}
            />
          ))}
        </div>

        {/* Add subtask input */}
        <div className="mt-2 flex items-center gap-2">
          <Plus className="size-4 text-muted-foreground" />
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add subtask..."
            className="h-8 flex-1"
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
