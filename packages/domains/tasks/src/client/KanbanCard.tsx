import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import type { Task } from '@slayzone/task/shared'
import type { Project } from '@slayzone/projects/shared'
import type { TerminalState } from '@slayzone/terminal/shared'
import { Card, CardContent, Tooltip, TooltipContent, TooltipTrigger, cn, getTerminalStateStyle } from '@slayzone/ui'
import { todayISO, PRIORITY_LABELS } from './kanban'
import { AlertCircle, Check, GitMerge, Link2 } from 'lucide-react'
import { usePty } from '@slayzone/terminal'

interface KanbanCardProps {
  task: Task
  isDragging?: boolean
  isFocused?: boolean
  onClick?: (e: React.MouseEvent) => void
  project?: Project
  showProject?: boolean
  isBlocked?: boolean
  subTaskCount?: { done: number; total: number }
}

const PRIORITY_BAR_COLORS: Record<number, string> = {
  1: 'bg-red-500',
  2: 'bg-orange-500',
  3: 'bg-yellow-500',
  4: 'bg-blue-400',
  5: 'bg-muted-foreground/30'
}

export function KanbanCard({
  task,
  isDragging,
  isFocused,
  onClick,
  project,
  showProject,
  isBlocked,
  subTaskCount
}: KanbanCardProps): React.JSX.Element {
  const today = todayISO()
  const isOverdue = task.due_date && task.due_date < today && task.status !== 'done'
  const prevStatusRef = useRef(task.status)
  const [justCompleted, setJustCompleted] = useState(false)

  // Terminal state tracking - use main terminal sessionId format (taskId:taskId)
  const { getState, subscribeState } = usePty()
  const mainSessionId = `${task.id}:${task.id}`
  const [terminalState, setTerminalState] = useState<TerminalState>(() => getState(mainSessionId))

  useEffect(() => {
    setTerminalState(getState(mainSessionId))
    return subscribeState(mainSessionId, (newState) => setTerminalState(newState))
  }, [mainSessionId, getState, subscribeState])

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
          isFocused && 'ring-2 ring-primary bg-muted/50',
          isOverdue && 'border-destructive',
          task.linear_url && 'border-l-2 border-l-indigo-500'
        )}
        data-task-id={task.id}
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
            <div className="flex items-start gap-3">
              <p className="text-xs font-medium line-clamp-3 flex-1 leading-tight whitespace-pre-wrap break-words">{task.title}</p>
              <div className="flex items-start gap-1.5 shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-end gap-[1.5px] shrink-0">
                    {[3, 5, 7, 9].map((h, i) => (
                      <span
                        key={i}
                        className={cn(
                          'w-[2px] rounded-[0.5px]',
                          i < 5 - task.priority
                            ? PRIORITY_BAR_COLORS[task.priority]
                            : 'bg-muted-foreground/20'
                        )}
                        style={{ height: h }}
                      />
                    ))}
                  </span>
                </TooltipTrigger>
                <TooltipContent>{PRIORITY_LABELS[task.priority]}</TooltipContent>
              </Tooltip>
              {/* Terminal state indicator - hide when starting */}
              {(() => {
                const stateStyle = terminalState !== 'starting' ? getTerminalStateStyle(terminalState) : null
                return stateStyle ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className={cn('h-2 w-2 rounded-full shrink-0 ml-0.5', stateStyle.color)} />
                    </TooltipTrigger>
                    <TooltipContent>{stateStyle.label}</TooltipContent>
                  </Tooltip>
                ) : null
              })()}
              {task.merge_state && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="shrink-0">
                      <GitMerge className="h-2.5 w-2.5 text-purple-400" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Merging</TooltipContent>
                </Tooltip>
              )}
              {task.linear_url && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="shrink-0 h-2 w-2 rounded-full bg-indigo-500" />
                  </TooltipTrigger>
                  <TooltipContent>Linked to Linear</TooltipContent>
                </Tooltip>
              )}
              {isBlocked && (
                <span className="flex items-center text-amber-500 shrink-0" title="Blocked">
                  <Link2 className="h-2.5 w-2.5" />
                </span>
              )}
              {isOverdue && (
                <span className="flex items-center text-destructive shrink-0">
                  <AlertCircle className="h-2 w-2" />
                </span>
              )}
              {/* Due date */}
              {task.due_date && !isOverdue && (
                <span className="text-muted-foreground text-[9px] shrink-0">{task.due_date}</span>
              )}
              {/* Sub-task count */}
              {subTaskCount && subTaskCount.total > 0 && (
                <span className={cn(
                  "flex items-center gap-0.5 text-[9px] shrink-0",
                  subTaskCount.done === subTaskCount.total ? "text-green-500" : "text-muted-foreground"
                )}>
                  <Check className="size-2" />
                  {subTaskCount.done}/{subTaskCount.total}
                </span>
              )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
    </motion.div>
  )
}
