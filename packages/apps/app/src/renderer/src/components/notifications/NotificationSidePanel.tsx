import { NotificationPanel } from './NotificationPanel'
import type { AttentionTask } from './useAttentionTasks'
import type { Project } from '@slayzone/projects/shared'

interface NotificationSidePanelProps {
  width: number
  attentionTasks: AttentionTask[]
  projects: Project[]
  filterCurrentProject: boolean
  onFilterToggle: () => void
  onNavigate: (taskId: string) => void
  onCloseTerminal: (sessionId: string) => void
  selectedProjectId: string
  currentProjectName?: string
}

export const NOTIFICATION_PANEL_MIN_WIDTH = 240
export const NOTIFICATION_PANEL_MAX_WIDTH = 480

export function NotificationSidePanel({
  width,
  attentionTasks,
  projects,
  filterCurrentProject,
  onFilterToggle,
  onNavigate,
  onCloseTerminal,
  selectedProjectId,
  currentProjectName
}: NotificationSidePanelProps) {
  return (
    <div className="relative h-full rounded-md bg-surface-1 border border-border overflow-hidden flex flex-col" style={{ width }}>
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
