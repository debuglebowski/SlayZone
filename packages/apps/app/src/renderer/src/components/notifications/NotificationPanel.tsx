import { useMemo } from 'react'
import { PanelRightClose, PanelRightOpen, X } from 'lucide-react'
import { Button, cn, Tooltip, TooltipTrigger, TooltipContent } from '@slayzone/ui'
import type { AttentionTask } from './useAttentionTasks'
import type { Project } from '@slayzone/projects/shared'

interface NotificationPanelProps {
  attentionTasks: AttentionTask[]
  projects: Project[]
  filterCurrentProject: boolean
  onFilterToggle: () => void
  onNavigate: (taskId: string) => void
  onCloseTerminal: (sessionId: string) => void
  onLockToggle: () => void
  isLocked: boolean
  selectedProjectId: string | null
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

const STATUS_ORDER = ['in_progress', 'todo', 'backlog', 'inbox', 'review', 'done'] as const
const STATUS_LABELS: Record<string, string> = {
  inbox: 'Inbox',
  backlog: 'Backlog',
  todo: 'Todo',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done'
}

export function NotificationPanel({
  attentionTasks,
  projects,
  filterCurrentProject,
  onFilterToggle,
  onNavigate,
  onCloseTerminal,
  onLockToggle,
  isLocked,
  selectedProjectId,
  currentProjectName
}: NotificationPanelProps) {
  const getProjectColor = (projectId: string | null): string | undefined => {
    if (!projectId) return undefined
    return projects.find((p) => p.id === projectId)?.color
  }

  // Group tasks by status
  const groupedTasks = useMemo(() => {
    const groups = new Map<string, AttentionTask[]>()
    for (const item of attentionTasks) {
      const status = item.task.status
      if (!groups.has(status)) groups.set(status, [])
      groups.get(status)!.push(item)
    }
    // Sort by STATUS_ORDER
    return STATUS_ORDER.filter((s) => groups.has(s)).map((status) => ({
      status,
      label: STATUS_LABELS[status] || status,
      tasks: groups.get(status)!
    }))
  }, [attentionTasks])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b gap-2">
        {selectedProjectId ? (
          <div className="flex gap-1 flex-1">
            <Button
              variant={!filterCurrentProject ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => filterCurrentProject && onFilterToggle()}
            >
              All
            </Button>
            <Button
              variant={filterCurrentProject ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => !filterCurrentProject && onFilterToggle()}
            >
              {currentProjectName || 'Current'}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-sm">All Projects</h4>
          </div>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={onLockToggle}>
          {isLocked ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}
        </Button>
      </div>

      <div className="flex-1 min-h-0 relative">
        <div className="absolute inset-0 overflow-y-auto p-2">
        {attentionTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No tasks need attention</p>
        ) : (
          groupedTasks.map(({ status, label, tasks }) => (
            <div key={status} className="mb-3">
              <div className="text-xs font-medium text-muted-foreground px-2 py-1">{label}</div>
              <div className="space-y-2">
                {tasks.map(({ task, sessionId, lastOutputTime }) => (
                  <div
                    key={task.id}
                    className="rounded-lg border bg-card p-3 shadow-sm hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => onNavigate(task.id)}
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
                        {formatIdleTime(lastOutputTime)} ago
                      </span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation()
                              onCloseTerminal(sessionId)
                            }}
                          >
                            <X className="size-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Kill terminal process</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
        </div>
      </div>
    </div>
  )
}
