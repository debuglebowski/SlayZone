import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensors,
  useSensor,
  pointerWithin,
  type DragStartEvent,
  type DragEndEvent
} from '@dnd-kit/core'
import type { Task, Project } from '../../../../shared/types/database'
import { groupTasksBy, type GroupKey } from '@/lib/kanban'
import { KanbanColumn } from './KanbanColumn'
import { KanbanCard } from './KanbanCard'

interface KanbanBoardProps {
  tasks: Task[]
  groupBy: GroupKey
  onTaskMove: (taskId: string, newColumnId: string) => void
  onTaskClick?: (task: Task) => void
  projectsMap?: Map<string, Project>
  showProjectDot?: boolean
  disableDrag?: boolean
}

export function KanbanBoard({
  tasks,
  groupBy,
  onTaskMove,
  onTaskClick,
  projectsMap,
  showProjectDot,
  disableDrag
}: KanbanBoardProps): React.JSX.Element {
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5
      }
    }),
    useSensor(KeyboardSensor)
  )

  const columns = groupTasksBy(tasks, groupBy)
  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null

  function handleDragStart(event: DragStartEvent): void {
    setActiveId(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent): void {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const taskId = active.id as string
    let targetColumnId = over.id as string

    // If dropped on a task, find its column
    const task = tasks.find((t) => t.id === targetColumnId)
    if (task) {
      // Find which column contains this task
      const column = columns.find((c) => c.tasks.some((t) => t.id === targetColumnId))
      if (column) {
        targetColumnId = column.id
      }
    }

    // Don't call onTaskMove if same column
    const currentColumn = columns.find((c) => c.tasks.some((t) => t.id === taskId))
    if (currentColumn?.id === targetColumnId) return

    onTaskMove(taskId, targetColumnId)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 h-full">
        {columns.map((column) => (
          <KanbanColumn
            key={column.id}
            column={column}
            onTaskClick={onTaskClick}
            projectsMap={projectsMap}
            showProjectDot={showProjectDot}
            disableDrag={disableDrag}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 150, easing: 'ease-out' }}>
        {activeTask ? (
          <KanbanCard
            task={activeTask}
            isDragging
            project={showProjectDot ? projectsMap?.get(activeTask.project_id) : undefined}
            showProject={showProjectDot}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
