import { useState } from 'react'
import { Home, X } from 'lucide-react'
import { cn, Tooltip, TooltipTrigger, TooltipContent, getTerminalStateStyle } from '@slayzone/ui'
import type { TerminalState } from '@slayzone/terminal/shared'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export type Tab = { type: 'home' } | { type: 'task'; taskId: string; title: string; terminalState?: TerminalState }

interface TabBarProps {
  tabs: Tab[]
  activeIndex: number
  terminalStates?: Map<string, TerminalState>
  onTabClick: (index: number) => void
  onTabClose: (index: number) => void
  onTabReorder: (fromIndex: number, toIndex: number) => void
  rightContent?: React.ReactNode
}

interface TabContentProps {
  title: string
  isActive: boolean
  isDragging?: boolean
  onClose?: () => void
  terminalState?: TerminalState
}

function getStateInfo(state: TerminalState | undefined) {
  return getTerminalStateStyle(state)
}

function TabContent({ title, isActive, isDragging, onClose, terminalState }: TabContentProps): React.JSX.Element {
  const stateInfo = getStateInfo(terminalState)

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 h-8 px-3 rounded-t-md cursor-pointer transition-colors select-none flex-shrink-0',
        'hover:bg-muted/50',
        isActive ? 'bg-muted border-b-2 border-b-primary' : 'text-muted-foreground',
        'min-w-[150px] max-w-[300px]',
        isDragging && 'shadow-lg'
      )}
    >
      {stateInfo && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={cn('w-2 h-2 rounded-full flex-shrink-0', stateInfo.color)} />
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {stateInfo.label}
          </TooltipContent>
        </Tooltip>
      )}
      <span className="truncate text-sm">{title}</span>
      {onClose && (
        <button
          className="h-4 w-4 rounded hover:bg-muted-foreground/20 flex items-center justify-center"
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

interface SortableTabProps {
  tab: Tab & { type: 'task' }
  index: number
  isActive: boolean
  onTabClick: (index: number) => void
  onTabClose: (index: number) => void
  terminalState?: TerminalState
}

function SortableTab({
  tab,
  index,
  isActive,
  onTabClick,
  onTabClose,
  terminalState
}: SortableTabProps): React.JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tab.taskId
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.5 : 1
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onTabClick(index)}
      onAuxClick={(e) => {
        if (e.button === 1) {
          e.preventDefault()
          onTabClose(index)
        }
      }}
      {...attributes}
      {...listeners}
    >
      <TabContent
        title={tab.title}
        isActive={isActive}
        onClose={() => onTabClose(index)}
        terminalState={terminalState}
      />
    </div>
  )
}

export function TabBar({
  tabs,
  activeIndex,
  terminalStates,
  onTabClick,
  onTabClose,
  onTabReorder,
  rightContent
}: TabBarProps): React.JSX.Element {
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5
      }
    })
  )

  const taskTabs = tabs.filter((t): t is Tab & { type: 'task' } => t.type === 'task')
  const taskIds = taskTabs.map((t) => t.taskId)
  const activeTab = activeId ? taskTabs.find((t) => t.taskId === activeId) : null

  function handleDragStart(event: DragStartEvent): void {
    setActiveId(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent): void {
    setActiveId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = tabs.findIndex((t) => t.type === 'task' && t.taskId === active.id)
    const newIndex = tabs.findIndex((t) => t.type === 'task' && t.taskId === over.id)

    if (oldIndex !== -1 && newIndex !== -1) {
      onTabReorder(oldIndex, newIndex)
    }
  }

  return (
    <div className="flex items-end h-9 pl-2 pr-2 gap-1 bg-background border-b">
      {/* Scrollable tabs area */}
      <div className="flex items-end gap-1 overflow-x-auto scrollbar-hide flex-1 min-w-0">
        {/* Home tab - not draggable */}
        <div
          className={cn(
            'flex items-center gap-1.5 h-8 px-3 rounded-t-md cursor-pointer transition-colors select-none flex-shrink-0',
            'hover:bg-muted/50',
            activeIndex === 0 ? 'bg-muted border-b-2 border-b-primary' : 'text-muted-foreground'
          )}
          onClick={() => onTabClick(0)}
        >
          <Home className="h-4 w-4" />
        </div>

        {/* Task tabs - sortable */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={taskIds} strategy={horizontalListSortingStrategy}>
            {taskTabs.map((tab) => {
              const index = tabs.findIndex((t) => t.type === 'task' && t.taskId === tab.taskId)
              return (
                <SortableTab
                  key={tab.taskId}
                  tab={tab}
                  index={index}
                  isActive={index === activeIndex}
                  onTabClick={onTabClick}
                  onTabClose={onTabClose}
                  terminalState={terminalStates?.get(tab.taskId)}
                />
              )
            })}
          </SortableContext>
          <DragOverlay>
            {activeTab && (
              <TabContent
                title={activeTab.title}
                isActive={tabs.findIndex((t) => t.type === 'task' && t.taskId === activeTab.taskId) === activeIndex}
                isDragging
                terminalState={terminalStates?.get(activeTab.taskId)}
              />
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Fixed right content */}
      {rightContent && (
        <div className="flex items-center flex-shrink-0 self-center">{rightContent}</div>
      )}
    </div>
  )
}
