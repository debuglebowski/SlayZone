import { X } from 'lucide-react'
import { IconButton, cn, Tooltip, TooltipTrigger, TooltipContent } from '@slayzone/ui'
import { track } from '@slayzone/telemetry/client'
import type { IdleTask } from './useIdleTasks'
import type { Project } from '@slayzone/projects/shared'

interface AgentStatusPanelProps {
  idleTasks: IdleTask[]
  projects: Project[]
  filterCurrentProject: boolean
  onFilterToggle: () => void
  onNavigate: (taskId: string) => void
  onDismiss: (sessionId: string) => void
  selectedProjectId: string
  currentProjectName?: string
}

function formatIdleTime(lastOutputTime: number): string {
  const seconds = Math.floor((Date.now() - lastOutputTime) / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  return `${hours}h`
}

export function AgentStatusPanel({
  idleTasks,
  projects,
  filterCurrentProject,
  onFilterToggle,
  onNavigate,
  onDismiss,
  selectedProjectId,
  currentProjectName
}: AgentStatusPanelProps) {
  const sortedTasks = [...idleTasks].sort((a, b) => b.lastOutputTime - a.lastOutputTime)

  const getProjectColor = (projectId: string | null): string | undefined => {
    if (!projectId) return undefined
    return projects.find((p) => p.id === projectId)?.color
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center bg-surface-3 p-1 gap-1 mx-2 mt-2 rounded-lg">
        <button
          onClick={() => filterCurrentProject && onFilterToggle()}
          className={cn(
            'flex-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
            !filterCurrentProject
              ? 'bg-muted text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          All
        </button>
        {selectedProjectId && (
          <button
            onClick={() => !filterCurrentProject && onFilterToggle()}
            className={cn(
              'flex-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors truncate',
              filterCurrentProject
                ? 'bg-muted text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {currentProjectName || 'Current'}
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 relative">
        <div className="absolute inset-0 overflow-y-auto px-2 pt-2 space-y-2">
        {sortedTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No agents idle</p>
        ) : (
          sortedTasks.map(({ task, sessionId, lastOutputTime }) => (
            <div
              key={task.id}
              className="rounded-lg border bg-surface-2 p-3 shadow-sm hover:bg-accent/50 transition-colors cursor-pointer"
              onClick={() => {
                track('notification_clicked')
                onNavigate(task.id)
              }}
            >
              <div className="flex items-start gap-2">
                {!filterCurrentProject && (
                  <span
                    className={cn('w-2 h-2 rounded-full flex-shrink-0 mt-1.5')}
                    style={{ backgroundColor: getProjectColor(task.project_id) || '#888' }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{task.title}</div>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t">
                <span className="text-xs text-muted-foreground">
                  Idle {formatIdleTime(lastOutputTime)}
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <IconButton
                      aria-label="Dismiss from list"
                      variant="ghost"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDismiss(sessionId)
                      }}
                    >
                      <X className="size-3" />
                    </IconButton>
                  </TooltipTrigger>
                  <TooltipContent>Hide until next agent activity</TooltipContent>
                </Tooltip>
              </div>
            </div>
          ))
        )}
        </div>
      </div>
    </div>
  )
}
