import { useDroppable } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task } from '../../../../shared/types/database'
import type { Column } from '@/lib/kanban'
import { KanbanCard } from './KanbanCard'
import { cn } from '@/lib/utils'

interface SortableKanbanCardProps {
  task: Task
  onTaskClick?: (task: Task) => void
}

function SortableKanbanCard({ task, onTaskClick }: SortableKanbanCardProps): React.JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <KanbanCard task={task} isDragging={isDragging} onClick={() => onTaskClick?.(task)} />
    </div>
  )
}

interface KanbanColumnProps {
  column: Column
  onTaskClick?: (task: Task) => void
}

export function KanbanColumn({ column, onTaskClick }: KanbanColumnProps): React.JSX.Element {
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
              <SortableKanbanCard key={task.id} task={task} onTaskClick={onTaskClick} />
            ))}
          </div>
        </SortableContext>
      </div>
    </div>
  )
}
