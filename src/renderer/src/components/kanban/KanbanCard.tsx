import type { Task, Project } from '../../../../shared/types/database'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { todayISO } from '@/lib/kanban'
import { AlertCircle, Ban } from 'lucide-react'

interface KanbanCardProps {
  task: Task
  isDragging?: boolean
  onClick?: () => void
  project?: Project
  showProject?: boolean
}

export function KanbanCard({
  task,
  isDragging,
  onClick,
  project,
  showProject
}: KanbanCardProps): React.JSX.Element {
  const today = todayISO()
  const isOverdue = task.due_date && task.due_date < today && task.status !== 'done'
  const isBlocked = !!task.blocked_reason

  return (
    <Card
      className={cn(
        'cursor-grab transition-shadow select-none',
        isDragging && 'opacity-50 shadow-lg',
        isOverdue && 'border-destructive',
        isBlocked && 'border-yellow-500 opacity-60'
      )}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          {/* Project color dot - shown in All view */}
          {showProject && project ? (
            <div
              className="mt-1 h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: project.color }}
              title={project.name}
            />
          ) : showProject ? (
            <div className="mt-1 h-2 w-2 rounded-full bg-muted-foreground/30 shrink-0" />
          ) : null}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium line-clamp-2">{task.title}</p>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              {isOverdue && (
                <span className="flex items-center gap-1 text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  Overdue
                </span>
              )}
              {isBlocked && (
                <span className="flex items-center gap-1 text-yellow-500">
                  <Ban className="h-3 w-3" />
                  Blocked
                </span>
              )}
              {task.due_date && !isOverdue && <span>{task.due_date}</span>}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
