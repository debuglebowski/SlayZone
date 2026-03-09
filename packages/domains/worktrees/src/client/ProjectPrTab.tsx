import { useState, useEffect } from 'react'
import {
  ExternalLink,
  GitPullRequest,
  GitMerge,
  CircleDot,
  CircleX,
  Loader2
} from 'lucide-react'
import type { Task } from '@slayzone/task/shared'
import type { GhPullRequest } from '../shared/types'

interface ProjectPrTabProps {
  projectPath: string | null
  visible: boolean
  tasks: Task[]
  onTaskClick?: (task: Task) => void
}

export function ProjectPrTab({ projectPath, visible, tasks, onTaskClick }: ProjectPrTabProps) {
  const [prs, setPrs] = useState<GhPullRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!visible || !projectPath) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const list = await window.api.git.listOpenPrs(projectPath)
        if (!cancelled) setPrs(list)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [visible, projectPath])

  // Build map of PR URL → task
  const prTaskMap = new Map<string, Task>()
  for (const task of tasks) {
    if (task.pr_url) prTaskMap.set(task.pr_url, task)
  }

  if (!projectPath) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-xs text-muted-foreground">Set a project path to view pull requests</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-xs text-destructive">{error}</div>
    )
  }

  if (prs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-2">
          <GitPullRequest className="h-6 w-6 text-muted-foreground mx-auto" />
          <p className="text-xs text-muted-foreground">No open pull requests</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="py-1">
        {prs.map((pr) => {
          const linkedTask = prTaskMap.get(pr.url)
          return (
            <div
              key={pr.number}
              className="flex items-start gap-3 px-4 py-2.5 hover:bg-accent/50 transition-colors"
            >
              <PrStateIcon state={pr.state} isDraft={pr.isDraft} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium truncate">{pr.title}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">#{pr.number}</span>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {pr.headRefName} → {pr.baseRefName} · {pr.author}
                </div>
                {linkedTask && (
                  <button
                    className="text-[10px] text-primary hover:underline mt-0.5"
                    onClick={() => onTaskClick?.(linkedTask)}
                  >
                    {linkedTask.title}
                  </button>
                )}
              </div>
              <button
                className="shrink-0 p-1 hover:bg-accent rounded"
                onClick={() => window.api.shell.openExternal(pr.url)}
                title="Open in browser"
              >
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PrStateIcon({ state, isDraft }: { state: GhPullRequest['state']; isDraft: boolean }) {
  if (isDraft) return <GitPullRequest className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
  if (state === 'MERGED') return <GitMerge className="h-4 w-4 text-purple-500 shrink-0 mt-0.5" />
  if (state === 'CLOSED') return <CircleX className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
  return <CircleDot className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
}
