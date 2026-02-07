import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Minus } from 'lucide-react'
import { Button, cn } from '@slayzone/ui'
import type { Task } from '@slayzone/task/shared'
import type { GitDiffSnapshot } from '../shared/types'
import { parseUnifiedDiff, type FileDiff } from './parse-diff'
import { DiffView } from './DiffView'

interface GitDiffPanelProps {
  task: Task
  projectPath: string | null
  visible: boolean
  pollIntervalMs?: number
}

interface FileEntry {
  path: string
  status: 'M' | 'A' | 'D' | '?'
  source: 'unstaged' | 'staged'
}

function deriveStatus(path: string, diffs: FileDiff[]): 'M' | 'A' | 'D' {
  const diff = diffs.find((d) => d.path === path)
  if (diff?.isNew) return 'A'
  if (diff?.isDeleted) return 'D'
  return 'M'
}

const STATUS_COLORS: Record<FileEntry['status'], string> = {
  M: 'text-yellow-600 dark:text-yellow-400',
  A: 'text-green-600 dark:text-green-400',
  D: 'text-red-600 dark:text-red-400',
  '?': 'text-muted-foreground'
}

function HorizontalResizeHandle({ onDrag }: { onDrag: (deltaX: number) => void }) {
  const isDragging = useRef(false)
  const startX = useRef(0)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      isDragging.current = true
      startX.current = e.clientX

      const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging.current) return
        const delta = e.clientX - startX.current
        startX.current = e.clientX
        onDrag(delta)
      }

      const handleMouseUp = () => {
        isDragging.current = false
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [onDrag]
  )

  return (
    <div
      className="w-1 shrink-0 cursor-col-resize hover:bg-primary/20 active:bg-primary/30 transition-colors"
      onMouseDown={handleMouseDown}
    />
  )
}

function FileListItem({
  entry,
  selected,
  onClick,
  onAction
}: {
  entry: FileEntry
  selected: boolean
  onClick: () => void
  onAction: () => void
}) {
  return (
    <div
      className={cn(
        'group w-full text-left px-3 py-1 flex items-center gap-2 text-xs font-mono hover:bg-accent/50 transition-colors cursor-pointer',
        selected && 'bg-accent'
      )}
      onClick={onClick}
    >
      <span className={cn('font-bold shrink-0 w-3 text-center', STATUS_COLORS[entry.status])}>
        {entry.status}
      </span>
      <span className="truncate min-w-0 flex-1">{entry.path}</span>
      <button
        className="shrink-0 opacity-0 group-hover:opacity-100 hover:text-foreground text-muted-foreground transition-opacity p-0.5 rounded hover:bg-accent"
        onClick={(e) => {
          e.stopPropagation()
          onAction()
        }}
        title={entry.source === 'unstaged' ? 'Stage file' : 'Unstage file'}
      >
        {entry.source === 'unstaged' ? <Plus className="size-3.5" /> : <Minus className="size-3.5" />}
      </button>
    </div>
  )
}

export function GitDiffPanel({
  task,
  projectPath,
  visible,
  pollIntervalMs = 5000
}: GitDiffPanelProps): React.JSX.Element {
  const targetPath = useMemo(() => task.worktree_path ?? projectPath, [task.worktree_path, projectPath])
  const [snapshot, setSnapshot] = useState<GitDiffSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<{ path: string; source: 'unstaged' | 'staged' } | null>(null)
  const [fileListWidth, setFileListWidth] = useState(320)

  const fetchDiff = async (): Promise<void> => {
    if (!targetPath) return
    setLoading(true)
    try {
      const next = await window.api.git.getWorkingDiff(targetPath)
      setSnapshot(next)
      setError(null)
    } catch (err) {
      setSnapshot(null)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!visible || !targetPath) return
    fetchDiff()
    const timer = setInterval(() => {
      fetchDiff()
    }, pollIntervalMs)
    return () => clearInterval(timer)
  }, [visible, targetPath, pollIntervalMs])

  const unstagedFileDiffs = useMemo(
    () => parseUnifiedDiff(snapshot?.unstagedPatch ?? ''),
    [snapshot?.unstagedPatch]
  )
  const stagedFileDiffs = useMemo(
    () => parseUnifiedDiff(snapshot?.stagedPatch ?? ''),
    [snapshot?.stagedPatch]
  )

  const unstagedEntries: FileEntry[] = useMemo(() => {
    if (!snapshot) return []
    return [
      ...snapshot.unstagedFiles.map((f) => ({ path: f, status: deriveStatus(f, unstagedFileDiffs) as FileEntry['status'], source: 'unstaged' as const })),
      ...snapshot.untrackedFiles.map((f) => ({ path: f, status: '?' as const, source: 'unstaged' as const }))
    ]
  }, [snapshot, unstagedFileDiffs])

  const stagedEntries: FileEntry[] = useMemo(() => {
    if (!snapshot) return []
    return snapshot.stagedFiles.map((f) => ({ path: f, status: deriveStatus(f, stagedFileDiffs) as FileEntry['status'], source: 'staged' as const }))
  }, [snapshot, stagedFileDiffs])

  const allEntries = useMemo(() => [...unstagedEntries, ...stagedEntries], [unstagedEntries, stagedEntries])

  const selectedDiff = useMemo(() => {
    if (!selectedFile) return null
    const diffs = selectedFile.source === 'unstaged' ? unstagedFileDiffs : stagedFileDiffs
    return diffs.find((d) => d.path === selectedFile.path) ?? null
  }, [selectedFile, unstagedFileDiffs, stagedFileDiffs])

  // Clear selection when file no longer exists
  useEffect(() => {
    if (selectedFile && !allEntries.some((f) => f.path === selectedFile.path && f.source === selectedFile.source)) {
      setSelectedFile(null)
    }
  }, [allEntries, selectedFile])

  const handleStageAction = useCallback(async (filePath: string, source: 'unstaged' | 'staged') => {
    if (!targetPath) return
    try {
      if (source === 'unstaged') {
        await window.api.git.stageFile(targetPath, filePath)
      } else {
        await window.api.git.unstageFile(targetPath, filePath)
      }
      await fetchDiff()
    } catch {
      // silently fail — next poll will correct state
    }
  }, [targetPath])

  const handleResize = useCallback((delta: number) => {
    setFileListWidth((w) => Math.max(120, Math.min(400, w + delta)))
  }, [])

  const hasAnyChanges = !!snapshot && (
    snapshot.files.length > 0 ||
    snapshot.unstagedPatch.trim().length > 0 ||
    snapshot.stagedPatch.trim().length > 0
  )

  const isSelected = (entry: FileEntry) =>
    selectedFile?.path === entry.path && selectedFile?.source === entry.source

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Git diff</div>
          {snapshot && (
            <div className="text-[11px] text-muted-foreground mt-1">
              Updated {new Date(snapshot.generatedAt).toLocaleTimeString()}
            </div>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={fetchDiff}
          disabled={!targetPath || loading}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* Empty states */}
      {!targetPath && (
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-xs text-muted-foreground">
            Set a project path or worktree to view git diff
          </p>
        </div>
      )}

      {targetPath && error && (
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      {targetPath && !error && !loading && snapshot && !hasAnyChanges && (
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-xs text-muted-foreground">No local changes.</p>
        </div>
      )}

      {/* Main content: horizontal split */}
      {targetPath && !error && snapshot && hasAnyChanges && (
        <div className="flex-1 min-h-0 flex">
          {/* Left: stacked file lists */}
          <div className="shrink-0 flex flex-col min-h-0 overflow-y-auto border-r" style={{ width: fileListWidth }}>
            {/* Staged section */}
            {stagedEntries.length > 0 && (
              <div>
                <div className="px-3 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide bg-muted/30 border-b sticky top-0 z-10">
                  Staged ({stagedEntries.length})
                </div>
                {stagedEntries.map((entry) => (
                  <FileListItem
                    key={`s:${entry.path}`}
                    entry={entry}
                    selected={isSelected(entry)}
                    onClick={() => setSelectedFile({ path: entry.path, source: 'staged' })}
                    onAction={() => handleStageAction(entry.path, 'staged')}
                  />
                ))}
              </div>
            )}

            {/* Unstaged section */}
            {unstagedEntries.length > 0 && (
              <div>
                <div className="px-3 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide bg-muted/30 border-b sticky top-0 z-10">
                  Unstaged ({unstagedEntries.length})
                </div>
                {unstagedEntries.map((entry) => (
                  <FileListItem
                    key={`u:${entry.path}`}
                    entry={entry}
                    selected={isSelected(entry)}
                    onClick={() => setSelectedFile({ path: entry.path, source: 'unstaged' })}
                    onAction={() => handleStageAction(entry.path, 'unstaged')}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Resize handle */}
          <HorizontalResizeHandle onDrag={handleResize} />

          {/* Right: diff viewer */}
          <div className="flex-1 min-w-0 min-h-0 overflow-auto">
            {!selectedFile && (
              <div className="h-full flex items-center justify-center p-6">
                <p className="text-xs text-muted-foreground">Select a file to view diff</p>
              </div>
            )}
            {selectedFile && !selectedDiff && (
              <div className="h-full flex items-center justify-center p-6">
                <p className="text-xs text-muted-foreground">
                  {allEntries.find((f) => f.path === selectedFile.path && f.source === selectedFile.source)?.status === '?'
                    ? 'Untracked file — no diff available'
                    : 'No diff content'}
                </p>
              </div>
            )}
            {selectedFile && selectedDiff && <DiffView diff={selectedDiff} />}
          </div>
        </div>
      )}
    </div>
  )
}
