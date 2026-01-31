import { useState, useEffect } from 'react'
import { GitBranch, GitMerge, Plus, Trash2, FolderGit } from 'lucide-react'
import { Button } from '@omgslayzone/ui'
import type { Task, UpdateTaskInput } from '@omgslayzone/task/shared'
import { CreateWorktreeDialog } from './CreateWorktreeDialog'

interface GitPanelProps {
  task: Task
  projectPath: string | null
  onUpdateTask: (data: UpdateTaskInput) => Promise<Task>
  /** When true, UI is shown but backend calls are disabled */
  disabled?: boolean
}

export function GitPanel({ task, projectPath, onUpdateTask, disabled = false }: GitPanelProps) {
  const [isGitRepo, setIsGitRepo] = useState<boolean | null>(null)
  const [currentBranch, setCurrentBranch] = useState<string | null>(null)
  const [worktreeBranch, setWorktreeBranch] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [initializing, setInitializing] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Git
        </div>
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

  const handleCreated = async (worktreePath: string) => {
    await onUpdateTask({ id: task.id, worktreePath })
    setDialogOpen(false)
  }

  // No project path
  if (!projectPath) {
    return (
      <div className="space-y-3">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Git
        </div>
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
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Git
        </div>
        <p className="text-xs text-destructive">{error}</p>
      </div>
    )
  }

  // Not a git repo
  if (isGitRepo === false) {
    return (
      <div className="space-y-3">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Git
        </div>
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
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Git
        </div>
        <p className="text-xs text-muted-foreground">
          Checking...
        </p>
      </div>
    )
  }

  // Derive display name from path
  const worktreeName = task.worktree_path?.split('/').pop() || 'Worktree'

  // Is a git repo - show branch + worktree
  return (
    <div className="space-y-3">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Git
      </div>

      {/* Branch info */}
      <div className="flex items-center gap-2 text-sm">
        <GitBranch className="h-4 w-4 text-muted-foreground" />
        <span>{currentBranch || 'detached HEAD'}</span>
      </div>

      {/* Worktree section */}
      <div className="pt-2 border-t border-border/50">
        <div className="text-xs font-medium text-muted-foreground mb-2">
          Worktree
        </div>

        {hasWorktree ? (
          <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
            <FolderGit className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{worktreeName}</div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {worktreeBranch && (
                  <span className="flex items-center gap-1">
                    <GitBranch className="h-3 w-3" />
                    {worktreeBranch}
                  </span>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDelete}
              disabled={deleting}
              className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(true)}
              className="gap-2 w-full justify-start"
            >
              <Plus className="h-4 w-4" />
              Add Worktree
            </Button>
            <CreateWorktreeDialog
              open={dialogOpen}
              onOpenChange={setDialogOpen}
              projectPath={projectPath}
              onCreated={handleCreated}
            />
          </>
        )}
      </div>

      {/* AI Merge section */}
      <div className="pt-2 border-t border-border/50">
        <div className="text-xs font-medium text-muted-foreground mb-2">
          AI Merge
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled
          className="gap-2 w-full justify-start opacity-50"
        >
          <GitMerge className="h-4 w-4" />
          Merge with AI
        </Button>
      </div>
    </div>
  )
}
