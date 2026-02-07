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
  additions,
  deletions,
  onClick,
  onAction,
  itemRef
}: {
  entry: FileEntry
  selected: boolean
  additions?: number
  deletions?: number
  onClick: () => void
  onAction: () => void
  itemRef?: React.Ref<HTMLDivElement>
}) {
  const hasCounts = additions != null || deletions != null

  return (
    <div
      ref={itemRef}
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
      {hasCounts && (
        <span className="shrink-0 text-[10px] tabular-nums space-x-1">
          {additions != null && additions > 0 && (
            <span className="text-green-600 dark:text-green-400">+{additions}</span>
          )}
          {deletions != null && deletions > 0 && (
            <span className="text-red-600 dark:text-red-400">-{deletions}</span>
          )}
        </span>
      )}
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
  const [untrackedDiffs, setUntrackedDiffs] = useState<Map<string, FileDiff>>(new Map())
  const fileListRef = useRef<HTMLDivElement>(null)
  const selectedItemRef = useRef<HTMLDivElement>(null)

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

  // Flat list in render order: staged first, then unstaged
  const flatEntries = useMemo(() => [...stagedEntries, ...unstagedEntries], [stagedEntries, unstagedEntries])

  const allDiffsMap = useMemo(() => {
    const map = new Map<string, FileDiff>()
    for (const d of unstagedFileDiffs) map.set(`u:${d.path}`, d)
    for (const d of stagedFileDiffs) map.set(`s:${d.path}`, d)
    return map
  }, [unstagedFileDiffs, stagedFileDiffs])

  const getDiffForEntry = useCallback((entry: FileEntry): FileDiff | undefined => {
    const key = entry.source === 'staged' ? `s:${entry.path}` : `u:${entry.path}`
    return allDiffsMap.get(key) ?? (entry.status === '?' ? untrackedDiffs.get(entry.path) : undefined)
  }, [allDiffsMap, untrackedDiffs])

  const selectedDiff = useMemo(() => {
    if (!selectedFile) return null
    const entry = flatEntries.find((f) => f.path === selectedFile.path && f.source === selectedFile.source)
    if (!entry) return null
    return getDiffForEntry(entry) ?? null
  }, [selectedFile, flatEntries, getDiffForEntry])

  // Eagerly fetch diffs for all untracked files (for counts + preview)
  // Also clears cache when snapshot changes so stale entries don't persist
  useEffect(() => {
    if (!snapshot || !targetPath) return
    setUntrackedDiffs(new Map())
    for (const filePath of snapshot.untrackedFiles) {
      // Inline fetch to avoid stale closure on untrackedDiffs
      window.api.git.getUntrackedFileDiff(targetPath, filePath).then((patch) => {
        const parsed = parseUnifiedDiff(patch)
        if (parsed.length > 0) {
          setUntrackedDiffs((prev) => new Map(prev).set(filePath, parsed[0]))
        }
      }).catch(() => {
        // ignore — file may be binary or inaccessible
      })
    }
  }, [snapshot?.generatedAt, targetPath])

  // Clear selection when file no longer exists
  useEffect(() => {
    if (selectedFile && !flatEntries.some((f) => f.path === selectedFile.path && f.source === selectedFile.source)) {
      setSelectedFile(null)
    }
  }, [flatEntries, selectedFile])

  // Scroll selected item into view
  useEffect(() => {
    selectedItemRef.current?.scrollIntoView({ block: 'nearest' })
  }, [selectedFile])

  const handleBulkAction = useCallback(async (action: 'stageAll' | 'unstageAll') => {
    if (!targetPath) return
    try {
      if (action === 'stageAll') {
        await window.api.git.stageAll(targetPath)
      } else {
        await window.api.git.unstageAll(targetPath)
      }
      await fetchDiff()
    } catch {
      // silently fail — next poll will correct state
    }
  }, [targetPath])

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

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()

    const currentIdx = selectedFile
      ? flatEntries.findIndex((f) => f.path === selectedFile.path && f.source === selectedFile.source)
      : -1

    let nextIdx: number
    if (e.key === 'ArrowDown') {
      nextIdx = currentIdx < flatEntries.length - 1 ? currentIdx + 1 : 0
    } else {
      nextIdx = currentIdx > 0 ? currentIdx - 1 : flatEntries.length - 1
    }

    const next = flatEntries[nextIdx]
    if (next) {
      setSelectedFile({ path: next.path, source: next.source })
    }
  }, [selectedFile, flatEntries])

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
          <div
            ref={fileListRef}
            className="shrink-0 flex flex-col min-h-0 overflow-y-auto border-r outline-none"
            style={{ width: fileListWidth }}
            tabIndex={0}
            onKeyDown={handleKeyDown}
          >
            {/* Staged section */}
            {stagedEntries.length > 0 && (
              <div>
                <div className="px-3 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide bg-muted/30 border-b sticky top-0 z-10 flex items-center justify-between">
                  <span>Staged ({stagedEntries.length})</span>
                  <button
                    className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded hover:bg-accent"
                    onClick={() => handleBulkAction('unstageAll')}
                    title="Unstage all"
                  >
                    <Minus className="size-3.5" />
                  </button>
                </div>
                {stagedEntries.map((entry) => {
                  const diff = getDiffForEntry(entry)
                  return (
                    <FileListItem
                      key={`s:${entry.path}`}
                      entry={entry}
                      selected={isSelected(entry)}
                      additions={diff?.additions}
                      deletions={diff?.deletions}
                      onClick={() => setSelectedFile({ path: entry.path, source: 'staged' })}
                      onAction={() => handleStageAction(entry.path, 'staged')}
                      itemRef={isSelected(entry) ? selectedItemRef : undefined}
                    />
                  )
                })}
              </div>
            )}

            {/* Unstaged section */}
            {unstagedEntries.length > 0 && (
              <div>
                <div className="px-3 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide bg-muted/30 border-b sticky top-0 z-10 flex items-center justify-between">
                  <span>Unstaged ({unstagedEntries.length})</span>
                  <button
                    className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded hover:bg-accent"
                    onClick={() => handleBulkAction('stageAll')}
                    title="Stage all"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
                {unstagedEntries.map((entry) => {
                  const diff = getDiffForEntry(entry)
                  return (
                    <FileListItem
                      key={`u:${entry.path}`}
                      entry={entry}
                      selected={isSelected(entry)}
                      additions={diff?.additions}
                      deletions={diff?.deletions}
                      onClick={() => setSelectedFile({ path: entry.path, source: 'unstaged' })}
                      onAction={() => handleStageAction(entry.path, 'unstaged')}
                      itemRef={isSelected(entry) ? selectedItemRef : undefined}
                    />
                  )
                })}
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
                  {flatEntries.find((f) => f.path === selectedFile.path && f.source === selectedFile.source)?.status === '?'
                    ? 'Loading...'
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
