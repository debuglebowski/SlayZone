import { useDroppable } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task, Project } from '../../../../shared/types/database'
import type { Column } from '@/lib/kanban'
import { KanbanCard } from './KanbanCard'
import { cn } from '@/lib/utils'

interface SortableKanbanCardProps {
  task: Task
  onTaskClick?: (task: Task) => void
  project?: Project
  showProject?: boolean
  disableDrag?: boolean
}

function SortableKanbanCard({
  task,
  onTaskClick,
  project,
  showProject,
  disableDrag
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
        onClick={() => onTaskClick?.(task)}
        project={project}
        showProject={showProject}
      />
    </div>
  )
}

interface KanbanColumnProps {
  column: Column
  onTaskClick?: (task: Task) => void
  projectsMap?: Map<string, Project>
  showProjectDot?: boolean
  disableDrag?: boolean
}

export function KanbanColumn({
  column,
  onTaskClick,
  projectsMap,
  showProjectDot,
  disableDrag
}: KanbanColumnProps): React.JSX.Element {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id
  })

  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center justify-between px-2">
        <h3 className="text-sm font-semibold text-muted-foreground">{column.title}</h3>
        <span className="text-xs text-muted-foreground">{column.tasks.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 rounded-lg bg-muted/30 p-2 min-h-[200px]',
          isOver && 'bg-muted/50 ring-2 ring-primary/20'
        )}
      >
        <SortableContext items={column.tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {column.tasks.map((task) => (
              <SortableKanbanCard
                key={task.id}
                task={task}
                onTaskClick={onTaskClick}
                project={showProjectDot ? projectsMap?.get(task.project_id) : undefined}
                showProject={showProjectDot}
                disableDrag={disableDrag}
              />
            ))}
          </div>
        </SortableContext>
      </div>
    </div>
  )
}
