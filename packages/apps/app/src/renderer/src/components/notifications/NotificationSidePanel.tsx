import { useRef, useCallback } from 'react'
import { NotificationPanel } from './NotificationPanel'
import type { AttentionTask } from './useAttentionTasks'
import type { Project } from '@slayzone/projects/shared'

interface NotificationSidePanelProps {
  width: number
  onWidthChange: (width: number) => void
  attentionTasks: AttentionTask[]
  projects: Project[]
  filterCurrentProject: boolean
  onFilterToggle: () => void
  onNavigate: (taskId: string) => void
  onCloseTerminal: (sessionId: string) => void
  selectedProjectId: string
  currentProjectName?: string
}

const MIN_WIDTH = 240
const MAX_WIDTH = 480

export function NotificationSidePanel({
  width,
  onWidthChange,
  attentionTasks,
  projects,
  filterCurrentProject,
  onFilterToggle,
  onNavigate,
  onCloseTerminal,
  selectedProjectId,
  currentProjectName
}: NotificationSidePanelProps) {
  const isDragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(width)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      isDragging.current = true
      startX.current = e.clientX
      startWidth.current = width

      const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging.current) return
        const delta = startX.current - e.clientX
        const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta))
        onWidthChange(newWidth)
      }

      const handleMouseUp = () => {
        isDragging.current = false
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [width, onWidthChange]
  )

  return (
    <div className="relative h-full rounded-md bg-surface-1 border border-border overflow-hidden flex flex-col" style={{ width }}>
      <div
        className="absolute left-0 top-0 bottom-0 w-1 z-10 cursor-col-resize hover:bg-primary/20 active:bg-primary/30 transition-colors"
        onMouseDown={handleMouseDown}
      />
      <div className="flex items-center shrink-0 h-10 px-2 gap-1 border-b border-border bg-surface-1">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Attention</span>
      </div>
      <div className="flex-1 min-h-0">
        <NotificationPanel
            attentionTasks={attentionTasks}
            projects={projects}
            filterCurrentProject={filterCurrentProject}
            onFilterToggle={onFilterToggle}
            onNavigate={onNavigate}
            onCloseTerminal={onCloseTerminal}
            selectedProjectId={selectedProjectId}
            currentProjectName={currentProjectName}
          />
      </div>
    </div>
  )
}
