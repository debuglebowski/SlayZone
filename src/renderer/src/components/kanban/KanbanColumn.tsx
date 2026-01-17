import { useDroppable } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus } from 'lucide-react'
import type { Task, Project, Tag } from '../../../../shared/types/database'
import type { Column } from '@/lib/kanban'
import { KanbanCard } from './KanbanCard'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SortableKanbanCardProps {
  task: Task
  onTaskClick?: (task: Task, e: React.MouseEvent) => void
  project?: Project
  showProject?: boolean
  disableDrag?: boolean
  tags?: Tag[]
}

function SortableKanbanCard({
  task,
  onTaskClick,
  project,
  showProject,
  disableDrag,
  tags
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

  return (
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
  tags
}: KanbanColumnProps): React.JSX.Element {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id
  })

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
          items={column.tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-2">
            {column.tasks.map((task) => {
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
                />
              )
            })}
          </div>
        </SortableContext>
      </div>
    </div>
  )
}
