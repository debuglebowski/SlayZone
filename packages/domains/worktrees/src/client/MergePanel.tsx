import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Minus, Check, GitMerge, X } from 'lucide-react'
import {
  Button,
  Checkbox,
  cn
} from '@slayzone/ui'
import type { Task, UpdateTaskInput } from '@slayzone/task/shared'
import type { GitDiffSnapshot } from '../shared/types'
import { parseUnifiedDiff, type FileDiff } from './parse-diff'
import { DiffView } from './DiffView'
import { ConflictFileView } from './ConflictFileView'

// ── Shared helpers (from GitDiffPanel) ───────────────────────────────

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

function snapshotsEqual(a: GitDiffSnapshot, b: GitDiffSnapshot): boolean {
  return (
    a.unstagedPatch === b.unstagedPatch &&
    a.stagedPatch === b.stagedPatch &&
    arraysEqual(a.unstagedFiles, b.unstagedFiles) &&
    arraysEqual(a.stagedFiles, b.stagedFiles) &&
    arraysEqual(a.untrackedFiles, b.untrackedFiles)
  )
}

function deriveStatus(path: string, diffs: FileDiff[]): 'M' | 'A' | 'D' {
  const diff = diffs.find((d) => d.path === path)
  if (diff?.isNew) return 'A'
  if (diff?.isDeleted) return 'D'
  return 'M'
}

const STATUS_COLORS: Record<string, string> = {
  M: 'text-yellow-600 dark:text-yellow-400',
  A: 'text-green-600 dark:text-green-400',
  D: 'text-red-600 dark:text-red-400',
  '?': 'text-muted-foreground'
}

// ── MergePanel ───────────────────────────────────────────────────────

interface MergePanelProps {
  task: Task
  projectPath: string
  onUpdateTask: (data: UpdateTaskInput) => Promise<Task>
  onTaskUpdated: (task: Task) => void
}

export function MergePanel({ task, projectPath, onUpdateTask, onTaskUpdated }: MergePanelProps) {
  if (task.merge_state === 'uncommitted') {
    return (
      <UncommittedPhase
        task={task}
        projectPath={projectPath}
        onUpdateTask={onUpdateTask}
        onTaskUpdated={onTaskUpdated}
      />
    )
  }

  if (task.merge_state === 'conflicts') {
    return (
      <ConflictPhase
        task={task}
        projectPath={projectPath}
        onUpdateTask={onUpdateTask}
        onTaskUpdated={onTaskUpdated}
      />
    )
  }

  return null
}

// ── Phase 1: Uncommitted Changes ─────────────────────────────────────

function UncommittedPhase({ task, projectPath, onUpdateTask, onTaskUpdated }: MergePanelProps) {
  const targetPath = task.worktree_path ?? projectPath
  const [snapshot, setSnapshot] = useState<GitDiffSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<{ path: string; source: 'unstaged' | 'staged' } | null>(null)
  const prevSnapshotRef = useRef<GitDiffSnapshot | null>(null)

  const fetchDiff = useCallback(async () => {
    if (!targetPath) return
    setLoading(true)
    try {
      const next = await window.api.git.getWorkingDiff(targetPath)
      if (!prevSnapshotRef.current || !snapshotsEqual(prevSnapshotRef.current, next)) {
        prevSnapshotRef.current = next
        setSnapshot(next)
      }
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [targetPath])

  useEffect(() => {
    fetchDiff()
    const timer = setInterval(fetchDiff, 5000)
    return () => clearInterval(timer)
  }, [fetchDiff])

  const unstagedDiffs = useMemo(() => parseUnifiedDiff(snapshot?.unstagedPatch ?? ''), [snapshot?.unstagedPatch])
  const stagedDiffs = useMemo(() => parseUnifiedDiff(snapshot?.stagedPatch ?? ''), [snapshot?.stagedPatch])

  type FileEntry = { path: string; status: string; source: 'unstaged' | 'staged' }

  const allEntries: FileEntry[] = useMemo(() => {
    if (!snapshot) return []
    const staged = snapshot.stagedFiles.map(f => ({ path: f, status: deriveStatus(f, stagedDiffs), source: 'staged' as const }))
    const unstaged = [
      ...snapshot.unstagedFiles.map(f => ({ path: f, status: deriveStatus(f, unstagedDiffs), source: 'unstaged' as const })),
      ...snapshot.untrackedFiles.map(f => ({ path: f, status: '?', source: 'unstaged' as const }))
    ]
    return [...staged, ...unstaged]
  }, [snapshot, stagedDiffs, unstagedDiffs])

  const selectedDiff = useMemo(() => {
    if (!selectedFile) return null
    const diffs = selectedFile.source === 'staged' ? stagedDiffs : unstagedDiffs
    return diffs.find(d => d.path === selectedFile.path) ?? null
  }, [selectedFile, stagedDiffs, unstagedDiffs])

  const handleStageAction = useCallback(async (filePath: string, source: 'unstaged' | 'staged') => {
    if (!targetPath) return
    try {
      if (source === 'unstaged') await window.api.git.stageFile(targetPath, filePath)
      else await window.api.git.unstageFile(targetPath, filePath)
      await fetchDiff()
    } catch { /* next poll will correct */ }
  }, [targetPath, fetchDiff])

  const handleCommitAndContinue = useCallback(async () => {
    if (!targetPath) return
    setCommitting(true)
    setError(null)
    try {
      await window.api.git.stageAll(targetPath)
      await window.api.git.commitFiles(targetPath, 'WIP: changes before merge')

      // Now start the actual merge
      const sourceBranch = await window.api.git.getCurrentBranch(task.worktree_path!)
      if (!sourceBranch) {
        setError('Cannot merge: detached HEAD in worktree')
        setCommitting(false)
        return
      }

      // Start merge --no-commit on parent branch
      const result = await window.api.git.mergeWithAI(
        projectPath,
        task.worktree_path!,
        task.worktree_parent_branch!,
        sourceBranch
      )

      if (result.success) {
        // Clean merge — complete
        const updated = await onUpdateTask({ id: task.id, status: 'done', mergeState: null })
        onTaskUpdated(updated)
      } else if (result.resolving) {
        // Has conflicts — move to phase 2
        const updated = await onUpdateTask({ id: task.id, mergeState: 'conflicts' })
        onTaskUpdated(updated)
      } else if (result.error) {
        setError(result.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setCommitting(false)
    }
  }, [targetPath, task, projectPath, onUpdateTask, onTaskUpdated])

  const handleAbort = useCallback(async () => {
    const updated = await onUpdateTask({ id: task.id, mergeState: null })
    onTaskUpdated(updated)
  }, [task.id, onUpdateTask, onTaskUpdated])

  const hasChanges = !!snapshot && (snapshot.files.length > 0 || snapshot.unstagedPatch.trim().length > 0 || snapshot.stagedPatch.trim().length > 0)

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitMerge className="h-4 w-4 text-purple-400" />
          <span className="text-sm font-medium">Merge Mode — Uncommitted Changes</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleAbort}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleCommitAndContinue} disabled={committing || !hasChanges}>
            {committing ? 'Committing...' : 'Commit & Continue'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 bg-destructive/10 text-destructive text-xs">{error}</div>
      )}

      {!hasChanges && !loading && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">No uncommitted changes. Committing will proceed to merge.</p>
        </div>
      )}

      {hasChanges && (
        <div className="flex-1 min-h-0 flex">
          {/* File list */}
          <div className="w-72 shrink-0 overflow-y-auto border-r">
            {allEntries.map((entry) => (
              <div
                key={`${entry.source}:${entry.path}`}
                className={cn(
                  'group px-3 py-1 flex items-center gap-2 text-xs font-mono hover:bg-accent/50 cursor-pointer',
                  selectedFile?.path === entry.path && selectedFile?.source === entry.source && 'bg-accent'
                )}
                onClick={() => setSelectedFile({ path: entry.path, source: entry.source })}
              >
                <span className={cn('font-bold shrink-0 w-3 text-center', STATUS_COLORS[entry.status])}>
                  {entry.status}
                </span>
                <span className="truncate flex-1">{entry.path}</span>
                <button
                  className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground p-0.5"
                  onClick={(e) => { e.stopPropagation(); handleStageAction(entry.path, entry.source) }}
                  title={entry.source === 'unstaged' ? 'Stage' : 'Unstage'}
                >
                  {entry.source === 'unstaged' ? <Plus className="size-3.5" /> : <Minus className="size-3.5" />}
                </button>
              </div>
            ))}
          </div>

          {/* Diff viewer */}
          <div className="flex-1 min-w-0 overflow-auto">
            {!selectedFile && (
              <div className="h-full flex items-center justify-center">
                <p className="text-xs text-muted-foreground">Select a file to view diff</p>
              </div>
            )}
            {selectedFile && selectedDiff && <DiffView diff={selectedDiff} />}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Phase 2: Conflict Resolution ─────────────────────────────────────

function ConflictPhase({ task, projectPath, onUpdateTask, onTaskUpdated }: MergePanelProps) {
  const [conflictedFiles, setConflictedFiles] = useState<string[]>([])
  const [resolvedFiles, setResolvedFiles] = useState<Set<string>>(new Set())
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [completing, setCompleting] = useState(false)
  const [markDone, setMarkDone] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load conflicted files
  useEffect(() => {
    window.api.git.getConflictedFiles(projectPath).then(files => {
      setConflictedFiles(files)
      if (files.length > 0 && !selectedFile) setSelectedFile(files[0])
    })
  }, [projectPath])

  const handleFileResolved = useCallback((filePath: string) => {
    setResolvedFiles(prev => new Set(prev).add(filePath))
  }, [])

  const allResolved = conflictedFiles.length > 0 && conflictedFiles.every(f => resolvedFiles.has(f))

  const handleCompleteMerge = useCallback(async () => {
    setCompleting(true)
    setError(null)
    try {
      const sourceBranch = await window.api.git.getCurrentBranch(task.worktree_path!)
      await window.api.git.commitFiles(
        projectPath,
        `Merge ${sourceBranch ?? 'branch'} into ${task.worktree_parent_branch}`
      )
      const updates: UpdateTaskInput = { id: task.id, mergeState: null }
      if (markDone) updates.status = 'done'
      const updated = await onUpdateTask(updates)
      onTaskUpdated(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setCompleting(false)
    }
  }, [task, projectPath, markDone, onUpdateTask, onTaskUpdated])

  const handleAbort = useCallback(async () => {
    try {
      await window.api.git.abortMerge(projectPath)
    } catch { /* already aborted */ }
    const updated = await onUpdateTask({ id: task.id, mergeState: null })
    onTaskUpdated(updated)
  }, [task.id, projectPath, onUpdateTask, onTaskUpdated])

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitMerge className="h-4 w-4 text-purple-400" />
          <span className="text-sm font-medium">
            Merge Mode — Resolve Conflicts ({resolvedFiles.size}/{conflictedFiles.length})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleAbort}>
            Abort Merge
          </Button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 bg-destructive/10 text-destructive text-xs">{error}</div>
      )}

      {/* Main content */}
      <div className="flex-1 min-h-0 flex">
        {/* File list */}
        <div className="w-60 shrink-0 overflow-y-auto border-r">
          {conflictedFiles.map(file => (
            <div
              key={file}
              className={cn(
                'px-3 py-2 flex items-center gap-2 text-xs font-mono hover:bg-accent/50 cursor-pointer',
                selectedFile === file && 'bg-accent'
              )}
              onClick={() => setSelectedFile(file)}
            >
              {resolvedFiles.has(file) ? (
                <Check className="h-3 w-3 text-green-500 shrink-0" />
              ) : (
                <X className="h-3 w-3 text-red-500 shrink-0" />
              )}
              <span className="truncate">{file}</span>
            </div>
          ))}
        </div>

        {/* Conflict view */}
        <div className="flex-1 min-w-0 overflow-auto">
          {selectedFile ? (
            <ConflictFileView
              key={selectedFile}
              repoPath={projectPath}
              filePath={selectedFile}
              terminalMode={task.terminal_mode}
              onResolved={() => handleFileResolved(selectedFile)}
            />
          ) : (
            <div className="h-full flex items-center justify-center">
              <p className="text-xs text-muted-foreground">Select a file to resolve</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 py-3 border-t flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs">
          <Checkbox checked={markDone} onCheckedChange={(v) => setMarkDone(!!v)} />
          Mark task as done
        </label>
        <Button
          size="sm"
          onClick={handleCompleteMerge}
          disabled={!allResolved || completing}
        >
          {completing ? 'Completing...' : 'Complete Merge'}
        </Button>
      </div>
    </div>
  )
}
