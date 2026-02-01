import { Popover, PopoverContent, PopoverTrigger } from '@omgslayzone/ui'
import { NotificationButton } from './NotificationButton'
import { NotificationPanel } from './NotificationPanel'
import type { AttentionTask } from './useAttentionTasks'
import type { Project } from '@omgslayzone/projects/shared'

interface NotificationPopoverProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  attentionTasks: AttentionTask[]
  projects: Project[]
  filterCurrentProject: boolean
  onFilterToggle: () => void
  onNavigate: (taskId: string) => void
  onCloseTerminal: (sessionId: string) => void
  onLockToggle: () => void
  selectedProjectId: string | null
  currentProjectName?: string
}

export function NotificationPopover({
  open,
  onOpenChange,
  attentionTasks,
  projects,
  filterCurrentProject,
  onFilterToggle,
  onNavigate,
  onCloseTerminal,
  onLockToggle,
  selectedProjectId,
  currentProjectName
}: NotificationPopoverProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <NotificationButton count={attentionTasks.length} onClick={() => onOpenChange(!open)} />
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="w-80 p-0 max-h-96">
        <NotificationPanel
          attentionTasks={attentionTasks}
          projects={projects}
          filterCurrentProject={filterCurrentProject}
          onFilterToggle={onFilterToggle}
          onNavigate={onNavigate}
          onCloseTerminal={onCloseTerminal}
          onLockToggle={onLockToggle}
          isLocked={false}
          selectedProjectId={selectedProjectId}
          currentProjectName={currentProjectName}
        />
      </PopoverContent>
    </Popover>
  )
}
