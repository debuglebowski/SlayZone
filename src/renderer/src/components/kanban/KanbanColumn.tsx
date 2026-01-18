import { useDroppable } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus } from 'lucide-react'
import type { Task, Project, Tag } from '../../../../shared/types/database'
import type { Column } from '@/lib/kanban'
import { KanbanCard } from './KanbanCard'
import { TaskContextMenu } from './TaskContextMenu'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SortableKanbanCardProps {
  task: Task
  onTaskClick?: (task: Task, e: React.MouseEvent) => void
  project?: Project
  showProject?: boolean
  disableDrag?: boolean
  tags?: Tag[]
  // Context menu props
  allProjects?: Project[]
  onUpdateTask?: (taskId: string, updates: Partial<Task>) => void
  onArchiveTask?: (taskId: string) => void
  onDeleteTask?: (taskId: string) => void
}

function SortableKanbanCard({
  task,
  onTaskClick,
  project,
  showProject,
  disableDrag,
  tags,
  allProjects,
  onUpdateTask,
  onArchiveTask,
  onDeleteTask
}: SortableKanbanCardProps): React.JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: disableDrag
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }

  // When drag disabled, don't pass listeners/attributes
  const dragProps = disableDrag ? {} : { ...attributes, ...listeners }

  const card = (
    <div ref={setNodeRef} style={style} {...dragProps}>
      <KanbanCard
        task={task}
        isDragging={isDragging}
        onClick={(e) => onTaskClick?.(task, e)}
        project={project}
        showProject={showProject}
        tags={tags}
      />
    </div>
  )

  // Wrap with context menu if handlers provided
  if (allProjects && onUpdateTask && onArchiveTask && onDeleteTask) {
    return (
      <TaskContextMenu
        task={task}
        projects={allProjects}
        onUpdateTask={onUpdateTask}
        onArchiveTask={onArchiveTask}
        onDeleteTask={onDeleteTask}
      >
        {card}
      </TaskContextMenu>
    )
  }

  return card
}

interface KanbanColumnProps {
  column: Column
  onTaskClick?: (task: Task, e: React.MouseEvent) => void
  onCreateTask?: (column: Column) => void
  projectsMap?: Map<string, Project>
  showProjectDot?: boolean
  disableDrag?: boolean
  taskTags?: Map<string, string[]>
  allTasks?: Task[]
  tags?: Tag[]
  // Context menu props
  allProjects?: Project[]
  onUpdateTask?: (taskId: string, updates: Partial<Task>) => void
  onArchiveTask?: (taskId: string) => void
  onDeleteTask?: (taskId: string) => void
}

export function KanbanColumn({
  column,
  onTaskClick,
  onCreateTask,
  projectsMap,
  showProjectDot,
  disableDrag,
  taskTags,
  allTasks,
  tags,
  allProjects,
  onUpdateTask,
  onArchiveTask,
  onDeleteTask
}: KanbanColumnProps): React.JSX.Element {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id
  })

  // Split tasks into regular and blocked
  const regularTasks = column.tasks.filter((t) => !t.blocked_reason)
  const blockedTasks = column.tasks.filter((t) => !!t.blocked_reason)

  return (
    <div className="flex w-72 shrink-0 flex-col h-full">
      <div className="mb-2 flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-muted-foreground">{column.title}</h3>
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {column.tasks.length}
          </span>
        </div>
        {onCreateTask && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onCreateTask(column)}
            title="Add task"
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 h-full rounded-lg bg-muted/30 p-2 min-h-[200px]',
          isOver && 'bg-muted/50 ring-2 ring-primary/20'
        )}
      >
        <SortableContext
          items={[...regularTasks, ...blockedTasks].map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-2">
            {regularTasks.map((task) => {
              const taskTagIds = taskTags?.get(task.id) ?? []
              const taskTagsList =
                tags && taskTagIds.length > 0
                  ? tags.filter((t) => taskTagIds.includes(t.id))
                  : []

              return (
                <SortableKanbanCard
                  key={task.id}
                  task={task}
                  onTaskClick={onTaskClick}
                  project={showProjectDot ? projectsMap?.get(task.project_id) : undefined}
                  showProject={showProjectDot}
                  disableDrag={disableDrag}
                  tags={taskTagsList}
                  allProjects={allProjects}
                  onUpdateTask={onUpdateTask}
                  onArchiveTask={onArchiveTask}
                  onDeleteTask={onDeleteTask}
                />
              )
            })}
          </div>
          {blockedTasks.length > 0 && (
            <>
              <div className="flex items-center gap-2 my-3 px-1">
                <div className="flex-1 h-px bg-yellow-500/30" />
                <span className="text-[10px] font-medium text-yellow-600/70 uppercase tracking-wide">
                  Blocked
                </span>
                <div className="flex-1 h-px bg-yellow-500/30" />
              </div>
              <div className="flex flex-col gap-2">
                {blockedTasks.map((task) => {
                  const taskTagIds = taskTags?.get(task.id) ?? []
                  const taskTagsList =
                    tags && taskTagIds.length > 0
                      ? tags.filter((t) => taskTagIds.includes(t.id))
                      : []

                  return (
                    <SortableKanbanCard
                      key={task.id}
                      task={task}
                      onTaskClick={onTaskClick}
                      project={showProjectDot ? projectsMap?.get(task.project_id) : undefined}
                      showProject={showProjectDot}
                      disableDrag={disableDrag}
                      tags={taskTagsList}
                      allProjects={allProjects}
                      onUpdateTask={onUpdateTask}
                      onArchiveTask={onArchiveTask}
                      onDeleteTask={onDeleteTask}
                    />
                  )
                })}
              </div>
            </>
          )}
        </SortableContext>
      </div>
    </div>
  )
}
