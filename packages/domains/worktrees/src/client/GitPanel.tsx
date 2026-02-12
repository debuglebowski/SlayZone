import { useState, useEffect } from 'react'
import { GitBranch, GitMerge, Plus, Trash2 } from 'lucide-react'
import {
  Button,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@slayzone/ui'
import type { Task, UpdateTaskInput } from '@slayzone/task/shared'
import type { MergeResult } from '../shared/types'
import {
  DEFAULT_WORKTREE_BASE_PATH_TEMPLATE,
  joinWorktreePath,
  resolveWorktreeBasePathTemplate,
  slugify
} from './utils'

interface GitPanelProps {
  task: Task
  projectPath: string | null
  onUpdateTask: (data: UpdateTaskInput) => Promise<Task>
  onTaskUpdated: (task: Task) => void
  /** When true, UI is shown but backend calls are disabled */
  disabled?: boolean
}

export function GitPanel({ task, projectPath, onUpdateTask, onTaskUpdated, disabled = false }: GitPanelProps) {
  const [isGitRepo, setIsGitRepo] = useState<boolean | null>(null)
  const [currentBranch, setCurrentBranch] = useState<string | null>(null)
  const [worktreeBranch, setWorktreeBranch] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [initializing, setInitializing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mergeConfirmOpen, setMergeConfirmOpen] = useState(false)
  const [merging, setMerging] = useState(false)
  const [mergeResult, setMergeResult] = useState<MergeResult | null>(null)
  const hasWorktree = !!task.worktree_path

  // Check git status when projectPath changes
  useEffect(() => {
    if (!projectPath || disabled) {
      setIsGitRepo(null)
      setCurrentBranch(null)
      return
    }

    const checkGitStatus = async () => {
      setError(null)
      try {
        const isRepo = await window.api.git.isGitRepo(projectPath)
        setIsGitRepo(isRepo)
        if (isRepo) {
          const branch = await window.api.git.getCurrentBranch(projectPath)
          setCurrentBranch(branch)
        } else {
          setCurrentBranch(null)
        }
      } catch (err) {
        console.error('Failed to check git status:', err)
        setError(String(err))
      }
    }

    checkGitStatus()
  }, [projectPath, disabled])

  // Fetch worktree branch when worktree_path changes
  useEffect(() => {
    if (!task.worktree_path || disabled) {
      setWorktreeBranch(null)
      return
    }

    const fetchWorktreeBranch = async () => {
      try {
        const branch = await window.api.git.getCurrentBranch(task.worktree_path!)
        setWorktreeBranch(branch)
      } catch (err) {
        console.error('Failed to get worktree branch:', err)
        setWorktreeBranch(null)
      }
    }

    fetchWorktreeBranch()
  }, [task.worktree_path, disabled])

  // When disabled, show placeholder UI without backend calls
  if (disabled) {
    return (
      <div className="space-y-3">

        <p className="text-xs text-muted-foreground">
          Coming soon
        </p>
      </div>
    )
  }

  const handleInitGit = async () => {
    if (!projectPath) return
    setInitializing(true)
    try {
      await window.api.git.init(projectPath)
      setIsGitRepo(true)
      const branch = await window.api.git.getCurrentBranch(projectPath)
      setCurrentBranch(branch)
    } catch (err) {
      console.error('Failed to initialize git:', err)
    } finally {
      setInitializing(false)
    }
  }

  const handleDelete = async () => {
    if (!task.worktree_path || !projectPath) return

    setDeleting(true)
    try {
      await window.api.git.removeWorktree(projectPath, task.worktree_path)
      await onUpdateTask({ id: task.id, worktreePath: null })
    } catch (err) {
      console.error('Failed to delete worktree:', err)
    } finally {
      setDeleting(false)
    }
  }

  const handleAddWorktree = async () => {
    if (!projectPath) return
    setCreating(true)
    setError(null)
    try {
      // Get base path template from settings or use default, then resolve tokens.
      const basePathTemplate =
        (await window.api.settings.get('worktree_base_path')) ||
        DEFAULT_WORKTREE_BASE_PATH_TEMPLATE
      const basePath = resolveWorktreeBasePathTemplate(basePathTemplate, projectPath)

      // Generate branch name from task title
      const branch = slugify(task.title) || `task-${task.id.slice(0, 8)}`
      const worktreePath = joinWorktreePath(basePath, branch)

      await window.api.git.createWorktree(projectPath, worktreePath, branch)
      await onUpdateTask({
        id: task.id,
        worktreePath,
        worktreeParentBranch: currentBranch
      })
    } catch (err) {
      console.error('Failed to create worktree:', err)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setCreating(false)
    }
  }

  const handleMergeClick = () => {
    setMergeResult(null)
    setMergeConfirmOpen(true)
  }

  const handleMergeConfirm = async () => {
    if (!task.worktree_path || !task.worktree_parent_branch || !projectPath) return

    setMergeConfirmOpen(false)
    setMerging(true)
    setMergeResult(null)

    try {
      // Get worktree's current branch
      const sourceBranch = await window.api.git.getCurrentBranch(task.worktree_path)
      if (!sourceBranch) {
        setMergeResult({
          success: false,
          merged: false,
          conflicted: false,
          error: 'Cannot merge: worktree is in detached HEAD state'
        })
        return
      }

      // Check for uncommitted changes in worktree
      const hasChanges = await window.api.git.hasUncommittedChanges(task.worktree_path)
      if (hasChanges) {
        // Enter merge mode Phase 1 (uncommitted changes)
        const updated = await onUpdateTask({ id: task.id, mergeState: 'uncommitted' })
        onTaskUpdated(updated)
        return
      }

      // No uncommitted changes — try the merge
      const result = await window.api.git.mergeWithAI(
        projectPath,
        task.worktree_path,
        task.worktree_parent_branch,
        sourceBranch
      )

      if (result.success) {
        // Clean merge - mark done
        const updated = await onUpdateTask({ id: task.id, status: 'done' })
        onTaskUpdated(updated)
        await window.api.pty.kill(task.id)
        setMergeResult({ success: true, merged: true, conflicted: false })
      } else if (result.resolving) {
        // Has conflicts — enter merge mode Phase 2
        const updated = await onUpdateTask({ id: task.id, mergeState: 'conflicts' })
        onTaskUpdated(updated)
      } else if (result.error) {
        setMergeResult({
          success: false,
          merged: false,
          conflicted: false,
          error: result.error
        })
      }
    } catch (err) {
      setMergeResult({
        success: false,
        merged: false,
        conflicted: false,
        error: err instanceof Error ? err.message : String(err)
      })
    } finally {
      setMerging(false)
    }
  }

  // No project path
  if (!projectPath) {
    return (
      <div className="space-y-3">

        <p className="text-xs text-muted-foreground">
          Set a project path to use Git features
        </p>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-3">

        <p className="text-xs text-destructive">{error}</p>
      </div>
    )
  }

  // Not a git repo
  if (isGitRepo === false) {
    return (
      <div className="space-y-3">

        <p className="text-xs text-muted-foreground">
          Not a git repository
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleInitGit}
          disabled={initializing}
          className="gap-2 w-full justify-start"
        >
          {initializing ? 'Initializing...' : 'Initialize Git'}
        </Button>
      </div>
    )
  }

  // Loading state
  if (isGitRepo === null) {
    return (
      <div className="space-y-3">

        <p className="text-xs text-muted-foreground">
          Checking...
        </p>
      </div>
    )
  }

  // Derive display name from path
  const worktreeName = task.worktree_path?.split('/').pop() || 'Worktree'

  // In merge mode — show status instead of merge button
  if (task.merge_state) {
    return (
      <div className="space-y-3">

        <div className="flex items-center gap-2 text-sm">
          <GitMerge className="h-4 w-4 text-purple-400" />
          <span className="text-xs">
            {task.merge_state === 'uncommitted' ? 'Merge mode — reviewing changes' : 'Merge mode — resolving conflicts'}
          </span>
        </div>
      </div>
    )
  }

  // Is a git repo - show branch + worktree
  return (
    <div className="space-y-2">
      {/* Branch info - always show root branch */}
      <div>
        <label className="mb-1 block text-sm text-muted-foreground">Branch</label>
        <div className="flex items-center gap-2 text-sm">
          <GitBranch className="h-4 w-4 text-muted-foreground" />
          <span>{currentBranch || 'detached HEAD'}</span>
        </div>
      </div>

      {/* Worktree section */}
      <div className="pt-2">
        <div className="text-xs font-medium text-muted-foreground mb-2">
          Worktree
        </div>

        {hasWorktree ? (
          <div className="p-3 rounded-lg border bg-muted/30 space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{worktreeName}</div>
                {task.worktree_parent_branch && (
                  <div className="text-xs text-muted-foreground">
                    from {task.worktree_parent_branch}
                  </div>
                )}
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Remove worktree</TooltipContent>
              </Tooltip>
            </div>
            {task.worktree_parent_branch && (
              <>
                {mergeResult?.success ? (
                  <p className="text-xs text-green-500">Merged successfully - task marked done</p>
                ) : (
                  <>
                    {mergeResult?.error && (
                      <p className="text-xs text-destructive mb-2">{mergeResult.error}</p>
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleMergeClick}
                          disabled={merging}
                          className="gap-2 w-full justify-start"
                        >
                          <GitMerge className="h-4 w-4" />
                          {merging ? 'Merging...' : `Merge into ${task.worktree_parent_branch}`}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Merge and complete task
                      </TooltipContent>
                    </Tooltip>
                  </>
                )}
              </>
            )}
          </div>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddWorktree}
                disabled={creating}
                className="gap-2 w-full justify-start"
              >
                <Plus className="h-4 w-4" />
                {creating ? 'Creating...' : 'Add Worktree'}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Create branch "{slugify(task.title) || `task-${task.id.slice(0, 8)}`}"
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Merge confirmation dialog */}
      <AlertDialog open={mergeConfirmOpen} onOpenChange={setMergeConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Merge Worktree</AlertDialogTitle>
            <AlertDialogDescription>
              This will merge {worktreeBranch || 'the worktree branch'} into {task.worktree_parent_branch}.
              If there are conflicts, you'll review and resolve them in merge mode.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleMergeConfirm}>
              Start Merge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
