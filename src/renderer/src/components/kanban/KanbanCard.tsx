import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import type { Task, Project } from '../../../../shared/types/database'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { todayISO } from '@/lib/kanban'
import { AlertCircle, Ban, Repeat } from 'lucide-react'

interface KanbanCardProps {
  task: Task
  isDragging?: boolean
  onClick?: (e: React.MouseEvent) => void
  project?: Project
  showProject?: boolean
}

const PRIORITY_COLORS: Record<number, string> = {
  1: 'bg-red-500/10 text-red-600 dark:text-red-400',
  2: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  3: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  4: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  5: 'bg-gray-500/10 text-gray-600 dark:text-gray-400'
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
  const priorityColor = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS[3]
  const prevStatusRef = useRef(task.status)
  const [justCompleted, setJustCompleted] = useState(false)

  useEffect(() => {
    if (prevStatusRef.current !== 'done' && task.status === 'done') {
      setJustCompleted(true)
      setTimeout(() => setJustCompleted(false), 1000)
    }
    prevStatusRef.current = task.status
  }, [task.status])

  return (
    <motion.div
      whileTap={!isDragging ? { scale: 0.98 } : undefined}
      animate={
        justCompleted
          ? {
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0],
              transition: {
                duration: 0.1,
                ease: 'easeOut'
              }
            }
          : {}
      }
    >
      <Card
        className={cn(
          'cursor-grab transition-colors duration-[400ms] hover:duration-[100ms] select-none py-0 gap-0 hover:bg-muted/50',
          isDragging && 'opacity-50 shadow-lg',
          isOverdue && 'border-destructive',
          isBlocked && 'border-yellow-500 opacity-60'
        )}
        onClick={(e) => onClick?.(e)}
      >
      <CardContent className="px-2.5 py-5">
        <div className="flex items-start gap-3">
          {/* Project color dot - shown in All view */}
          {showProject && project ? (
            <div
              className="h-1.5 w-1.5 rounded-full shrink-0 mt-1"
              style={{ backgroundColor: project.color }}
              title={project.name}
            />
          ) : showProject ? (
            <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30 shrink-0 mt-1" />
          ) : null}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <p className="text-xs font-medium line-clamp-3 flex-1 leading-tight whitespace-pre-wrap break-words">{task.title}</p>
              {task.priority <= 2 && (
                <span
                  className={cn(
                    'shrink-0 text-[8px] font-semibold px-0.5 py-0 rounded',
                    priorityColor
                  )}
                >
                  P{task.priority}
                </span>
              )}
              {/* Status indicators */}
              {isOverdue && (
                <span className="flex items-center text-destructive shrink-0">
                  <AlertCircle className="h-2 w-2" />
                </span>
              )}
              {isBlocked && (
                <span className="flex items-center text-yellow-500 shrink-0">
                  <Ban className="h-2 w-2" />
                </span>
              )}
              {/* Recurrence indicator */}
              {task.recurrence_type && (
                <span className="flex items-center text-muted-foreground shrink-0">
                  <Repeat className="h-2 w-2" />
                </span>
              )}
              {/* Due date */}
              {task.due_date && !isOverdue && (
                <span className="text-muted-foreground text-[9px] shrink-0">{task.due_date}</span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
    </motion.div>
  )
}
