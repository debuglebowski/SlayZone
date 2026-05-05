import { AgentStatusPanel } from './AgentStatusPanel'
import type { IdleTask } from './useIdleTasks'
import type { Project } from '@slayzone/projects/shared'

interface AgentStatusSidePanelProps {
  width: number
  idleTasks: IdleTask[]
  projects: Project[]
  filterCurrentProject: boolean
  onFilterToggle: () => void
  onNavigate: (taskId: string) => void
  onDismiss: (sessionId: string) => void
  selectedProjectId: string
  currentProjectName?: string
}

export const AGENT_STATUS_PANEL_MIN_WIDTH = 240
export const AGENT_STATUS_PANEL_MAX_WIDTH = 480

export function AgentStatusSidePanel({
  width,
  idleTasks,
  projects,
  filterCurrentProject,
  onFilterToggle,
  onNavigate,
  onDismiss,
  selectedProjectId,
  currentProjectName
}: AgentStatusSidePanelProps) {
  return (
    <div className="relative h-full rounded-md bg-surface-1 border border-border overflow-hidden flex flex-col" style={{ width }}>
      <div className="flex items-center shrink-0 h-10 px-2 gap-1 border-b border-border bg-surface-1">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Agent Status</span>
      </div>
      <div className="flex-1 min-h-0">
        <AgentStatusPanel
          idleTasks={idleTasks}
          projects={projects}
          filterCurrentProject={filterCurrentProject}
          onFilterToggle={onFilterToggle}
          onNavigate={onNavigate}
          onDismiss={onDismiss}
          selectedProjectId={selectedProjectId}
          currentProjectName={currentProjectName}
        />
      </div>
    </div>
  )
}
