import type { Task } from '../../../shared/types/database'
import { Button } from '@/components/ui/button'
import { Pencil, Trash2 } from 'lucide-react'
import { format, isPast, parseISO } from 'date-fns'

interface TaskItemProps {
  task: Task
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
}

const statusColors: Record<string, string> = {
  inbox: 'bg-gray-200 text-gray-700',
  backlog: 'bg-slate-200 text-slate-700',
  todo: 'bg-blue-200 text-blue-700',
  in_progress: 'bg-yellow-200 text-yellow-700',
  review: 'bg-purple-200 text-purple-700',
  done: 'bg-green-200 text-green-700'
}

const statusLabels: Record<string, string> = {
  inbox: 'Inbox',
  backlog: 'Backlog',
  todo: 'Todo',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done'
}

export function TaskItem({ task, onEdit, onDelete }: TaskItemProps): React.JSX.Element {
  const isOverdue = task.due_date && task.status !== 'done' && isPast(parseISO(task.due_date))
  const isBlocked = !!task.blocked_reason

  return (
    <div className="flex items-center gap-3 rounded-md border px-3 py-2 hover:bg-muted/50">
      {/* Priority */}
      <span className="w-6 text-xs font-medium text-muted-foreground">
        P{task.priority}
      </span>

      {/* Title */}
      <span className={`flex-1 truncate ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
        {task.title}
      </span>

      {/* Blocked badge */}
      {isBlocked && (
        <span
          className="rounded bg-red-200 px-1.5 py-0.5 text-xs font-medium text-red-700"
          title={task.blocked_reason ?? undefined}
        >
          Blocked
        </span>
      )}

      {/* Status badge */}
      <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${statusColors[task.status]}`}>
        {statusLabels[task.status]}
      </span>

      {/* Due date */}
      {task.due_date && (
        <span className={`text-xs ${isOverdue ? 'font-medium text-red-600' : 'text-muted-foreground'}`}>
          {format(parseISO(task.due_date), 'MMM d')}
        </span>
      )}

      {/* Actions */}
      <div className="flex gap-1">
        <Button variant="ghost" size="icon-sm" onClick={() => onEdit(task)}>
          <Pencil className="size-4" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={() => onDelete(task)}>
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  )
}
