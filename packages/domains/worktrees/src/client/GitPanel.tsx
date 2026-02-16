import { useState, useEffect } from 'react'
import { GitBranch, GitMerge } from 'lucide-react'
import { Button } from '@slayzone/ui'
import type { Task, UpdateTaskInput } from '@slayzone/task/shared'

interface GitPanelProps {
  task: Task
  projectPath: string | null
  onUpdateTask: (data: UpdateTaskInput) => Promise<Task>
  onTaskUpdated: (task: Task) => void
  disabled?: boolean
  onOpenGitPanel?: () => void
}

export function GitPanel({ task, projectPath, onUpdateTask, onTaskUpdated, disabled = false, onOpenGitPanel }: GitPanelProps) {
  const [currentBranch, setCurrentBranch] = useState<string | null>(null)
  const [isGitRepo, setIsGitRepo] = useState<boolean | null>(null)

  // Check git status
  useEffect(() => {
    if (!projectPath || disabled) { setIsGitRepo(null); setCurrentBranch(null); return }
    window.api.git.isGitRepo(projectPath).then(isRepo => {
      setIsGitRepo(isRepo)
      if (isRepo) window.api.git.getCurrentBranch(projectPath).then(setCurrentBranch)
    }).catch(() => setIsGitRepo(null))
  }, [projectPath, disabled])

  // Detect rebase started from terminal
  useEffect(() => {
    if (!projectPath || disabled || task.merge_state) return
    const targetPath = task.worktree_path ?? projectPath
    let cancelled = false
    const poll = async () => {
      try {
        const rebasing = await window.api.git.isRebaseInProgress(targetPath)
        if (rebasing && !cancelled) {
          const ctx = await window.api.git.getMergeContext(targetPath)
          if (ctx && !cancelled) {
            const updated = await onUpdateTask({ id: task.id, mergeState: 'rebase-conflicts', mergeContext: ctx })
            onTaskUpdated(updated)
            onOpenGitPanel?.()
          }
        }
      } catch { /* ignore */ }
    }
    poll()
    const interval = setInterval(poll, 3000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [projectPath, disabled, task.merge_state, task.worktree_path, task.id, onUpdateTask, onTaskUpdated, onOpenGitPanel])

  if (disabled) return <p className="text-xs text-muted-foreground">Coming soon</p>

  if (!projectPath || isGitRepo === null) return null

  if (isGitRepo === false) {
    return <p className="text-xs text-muted-foreground">Not a git repository</p>
  }

  const worktreeBranch = task.worktree_path ? currentBranch : null

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm">
        <GitBranch className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="truncate">{worktreeBranch ?? currentBranch ?? 'detached HEAD'}</span>
      </div>

      {task.merge_state && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <GitMerge className="h-4 w-4 text-purple-400 shrink-0" />
          <span>
            {task.merge_state === 'uncommitted' ? 'Merge — reviewing changes'
              : task.merge_state === 'rebase-conflicts' ? 'Rebase — resolving conflicts'
              : 'Merge — resolving conflicts'}
          </span>
        </div>
      )}

      <Button variant="outline" size="sm" onClick={onOpenGitPanel} className="w-full">
        Open Git Panel
      </Button>
    </div>
  )
}
