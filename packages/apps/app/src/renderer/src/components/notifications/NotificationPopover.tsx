import { Popover, PopoverContent, PopoverTrigger } from '@slayzone/ui'
import { NotificationButton } from './NotificationButton'
import { NotificationPanel } from './NotificationPanel'
import type { AttentionTask } from './useAttentionTasks'
import type { Project } from '@slayzone/projects/shared'

interface NotificationPopoverProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  attentionTasks: AttentionTask[]
  projects: Project[]
  filterCurrentProject: boolean
  onFilterToggle: () => void
  onNavigate: (taskId: string) => void
  onCloseTerminal: (sessionId: string) => void
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
  selectedProjectId,
  currentProjectName
}: NotificationPopoverProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <NotificationButton active={attentionTasks.length > 0} count={attentionTasks.length} onClick={() => onOpenChange(!open)} />
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="w-80 p-0 max-h-96">
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
      </PopoverContent>
    </Popover>
  )
}
