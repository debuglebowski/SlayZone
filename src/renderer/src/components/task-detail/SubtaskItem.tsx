import { useState, useRef, useEffect } from 'react'
import { X } from 'lucide-react'
import type { Task } from '../../../../shared/types/database'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SubtaskItemProps {
  subtask: Task
  onUpdate: (subtask: Task) => void
  onDelete: (subtaskId: string) => void
}

export function SubtaskItem({
  subtask,
  onUpdate,
  onDelete
}: SubtaskItemProps): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [titleValue, setTitleValue] = useState(subtask.title)
  const inputRef = useRef<HTMLInputElement>(null)

  const isDone = subtask.status === 'done'

  // Focus input when editing
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const handleStatusToggle = async (): Promise<void> => {
    const newStatus = isDone ? 'todo' : 'done'
    const updated = await window.api.db.updateTask({
      id: subtask.id,
      status: newStatus
    })
    onUpdate(updated)
  }

  const handleTitleSave = async (): Promise<void> => {
    if (titleValue === subtask.title || !titleValue.trim()) {
      setTitleValue(subtask.title)
      setEditing(false)
      return
    }

    const updated = await window.api.db.updateTask({
      id: subtask.id,
      title: titleValue.trim()
    })
    onUpdate(updated)
    setEditing(false)
  }

  const handleKeyDown = async (e: React.KeyboardEvent): Promise<void> => {
    if (e.key === 'Enter') {
      await handleTitleSave()
    } else if (e.key === 'Escape') {
      setTitleValue(subtask.title)
      setEditing(false)
    }
  }

  const handleDelete = async (): Promise<void> => {
    await window.api.db.deleteTask(subtask.id)
    onDelete(subtask.id)
  }

  return (
    <div className="group flex items-center gap-2 py-2">
      <Checkbox checked={isDone} onCheckedChange={handleStatusToggle} />

      {editing ? (
        <Input
          ref={inputRef}
          value={titleValue}
          onChange={(e) => setTitleValue(e.target.value)}
          onBlur={handleTitleSave}
          onKeyDown={handleKeyDown}
          className="h-7 flex-1"
        />
      ) : (
        <span
          onClick={() => setEditing(true)}
          className={cn(
            'flex-1 cursor-pointer text-sm',
            isDone && 'text-muted-foreground line-through'
          )}
        >
          {subtask.title}
        </span>
      )}

      <Button
        variant="ghost"
        size="icon"
        className="size-6 opacity-0 group-hover:opacity-100"
        onClick={handleDelete}
      >
        <X className="size-3" />
      </Button>
    </div>
  )
}
