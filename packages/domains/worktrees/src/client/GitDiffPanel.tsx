import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Minus, Undo2 } from 'lucide-react'
import { Button, FileTree, buildFileTree, flattenFileTree, fileTreeIndent, cn } from '@slayzone/ui'
import type { Task } from '@slayzone/task/shared'
import type { GitDiffSnapshot } from '../shared/types'
import { parseUnifiedDiff, type FileDiff } from './parse-diff'
import { DiffView } from './DiffView'

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

const getEntryPath = (entry: FileEntry) => entry.path

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

const FileListItem = memo(function FileListItem({
  entry,
  displayName,
  selected,
  additions,
  deletions,
  onClick,
  onAction,
  onDiscard,
  itemRef,
  depth = 0
}: {
  entry: FileEntry
  displayName?: string
  selected: boolean
  additions?: number
  deletions?: number
  onClick: () => void
  onAction: () => void
  onDiscard?: () => void
  itemRef?: React.Ref<HTMLDivElement>
  depth?: number
}) {
  const hasCounts = additions != null || deletions != null

  return (
    <div
      ref={itemRef}
      className={cn(
        'group w-full text-left py-1 pr-3 flex items-center gap-1.5 text-xs font-mono hover:bg-muted/50 transition-colors cursor-pointer rounded',
        selected && 'bg-primary/10'
      )}
      style={{ paddingLeft: fileTreeIndent(depth) }}
      onClick={onClick}
    >
      <span className={cn('font-bold shrink-0 w-3 text-center', STATUS_COLORS[entry.status])}>
        {entry.status}
      </span>
      <span className="truncate min-w-0 flex-1">{displayName ?? entry.path}</span>
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
      {onDiscard && (
        <button
          className="shrink-0 opacity-0 group-hover:opacity-100 hover:text-destructive text-muted-foreground transition-opacity p-0.5 rounded hover:bg-accent"
          onClick={(e) => {
            e.stopPropagation()
            onDiscard()
          }}
          title="Discard changes"
        >
          <Undo2 className="size-3.5" />
        </button>
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
})

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
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const splitContainerRef = useRef<HTMLDivElement>(null)
  const fileListRef = useRef<HTMLDivElement>(null)
  const selectedItemRef = useRef<HTMLDivElement>(null)
  const prevSnapshotRef = useRef<GitDiffSnapshot | null>(null)
  const didInitSplitRef = useRef(false)

  const fetchDiff = async (): Promise<void> => {
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
      prevSnapshotRef.current = null
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

  // Flat list for selection logic
  const flatEntries = useMemo(() => [...stagedEntries, ...unstagedEntries], [stagedEntries, unstagedEntries])

  // Build trees for keyboard nav flattening (respecting collapsed folders)
  const stagedTree = useMemo(() => buildFileTree(stagedEntries, getEntryPath, { compress: true }), [stagedEntries])
  const unstagedTree = useMemo(() => buildFileTree(unstagedEntries, getEntryPath, { compress: true }), [unstagedEntries])

  // Invert expanded → collapsed for flattenFileTree
  const collapsedFolders = useMemo(() => {
    const allPaths = new Set<string>()
    function walk(nodes: typeof stagedTree) {
      for (const n of nodes) {
        if (n.type === 'folder') { allPaths.add(n.path); walk(n.children) }
      }
    }
    walk(stagedTree)
    walk(unstagedTree)
    const collapsed = new Set<string>()
    for (const p of allPaths) {
      if (!expandedFolders.has(p)) collapsed.add(p)
    }
    return collapsed
  }, [stagedTree, unstagedTree, expandedFolders])

  const visibleFlatEntries = useMemo(
    () => [
      ...flattenFileTree(stagedTree, collapsedFolders),
      ...flattenFileTree(unstagedTree, collapsedFolders)
    ],
    [stagedTree, unstagedTree, collapsedFolders]
  )

  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  // Auto-expand all folders when new folders appear
  const prevFolderPathsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    const allPaths = new Set<string>()
    function walk(nodes: typeof stagedTree) {
      for (const n of nodes) {
        if (n.type === 'folder') { allPaths.add(n.path); walk(n.children) }
      }
    }
    walk(stagedTree)
    walk(unstagedTree)
    const prev = prevFolderPathsRef.current
    const newPaths = [...allPaths].filter((p) => !prev.has(p))
    prevFolderPathsRef.current = allPaths
    if (newPaths.length > 0) {
      setExpandedFolders((old) => {
        const next = new Set(old)
        for (const p of newPaths) next.add(p)
        return next
      })
    }
  }, [stagedTree, unstagedTree])

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

  // Eagerly fetch diffs for untracked files (for counts + preview)
  const prevUntrackedRef = useRef<string[]>([])
  useEffect(() => {
    if (!snapshot || !targetPath) return
    const curr = snapshot.untrackedFiles
    const prev = prevUntrackedRef.current
    prevUntrackedRef.current = curr

    const currSet = new Set(curr)
    const prevSet = new Set(prev)

    const removed = prev.filter((f) => !currSet.has(f))
    if (removed.length > 0) {
      setUntrackedDiffs((old) => {
        const next = new Map(old)
        for (const f of removed) next.delete(f)
        return next
      })
    }

    const added = curr.filter((f) => !prevSet.has(f))
    for (const filePath of added) {
      window.api.git.getUntrackedFileDiff(targetPath, filePath).then((patch) => {
        const parsed = parseUnifiedDiff(patch)
        if (parsed.length > 0) {
          setUntrackedDiffs((old) => new Map(old).set(filePath, parsed[0]))
        }
      }).catch(() => {
        // ignore — file may be binary or inaccessible
      })
    }
  }, [snapshot, targetPath])

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

  const handleDiscardFile = useCallback(async (filePath: string) => {
    if (!targetPath) return
    try {
      await window.api.git.discardFile(targetPath, filePath)
      await fetchDiff()
    } catch {
      // silently fail — next poll will correct state
    }
  }, [targetPath])

  const handleSelectFile = useCallback((path: string, source: 'unstaged' | 'staged') => {
    setSelectedFile({ path, source })
  }, [])

  const handleResize = useCallback((delta: number) => {
    setFileListWidth((w) => Math.max(50, w + delta))
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()

    const currentIdx = selectedFile
      ? visibleFlatEntries.findIndex((f) => f.path === selectedFile.path && f.source === selectedFile.source)
      : -1

    let nextIdx: number
    if (e.key === 'ArrowDown') {
      nextIdx = currentIdx < visibleFlatEntries.length - 1 ? currentIdx + 1 : 0
    } else {
      nextIdx = currentIdx > 0 ? currentIdx - 1 : visibleFlatEntries.length - 1
    }

    const next = visibleFlatEntries[nextIdx]
    if (next) {
      setSelectedFile({ path: next.path, source: next.source })
    }
  }, [selectedFile, visibleFlatEntries])

  const hasAnyChanges = !!snapshot && (
    snapshot.files.length > 0 ||
    snapshot.unstagedPatch.trim().length > 0 ||
    snapshot.stagedPatch.trim().length > 0
  )

  useEffect(() => {
    if (!hasAnyChanges || didInitSplitRef.current) return
    const containerWidth = splitContainerRef.current?.clientWidth ?? 0
    if (containerWidth <= 0) return
    didInitSplitRef.current = true
    setFileListWidth(Math.max(50, containerWidth / 2))
  }, [hasAnyChanges])

  const isSelected = (entry: FileEntry) =>
    selectedFile?.path === entry.path && selectedFile?.source === entry.source

  const renderFileItem = useCallback((entry: FileEntry, { name, depth }: { name: string; depth: number }) => {
    const diff = getDiffForEntry(entry)
    const selected = isSelected(entry)
    const canDiscard = entry.source === 'unstaged' && entry.status !== '?'
    return (
      <FileListItem
        entry={entry}
        displayName={name}
        selected={selected}
        additions={diff?.additions}
        deletions={diff?.deletions}
        onClick={() => handleSelectFile(entry.path, entry.source)}
        onAction={() => handleStageAction(entry.path, entry.source)}
        onDiscard={canDiscard ? () => handleDiscardFile(entry.path) : undefined}
        itemRef={selected ? selectedItemRef : undefined}
        depth={depth}
      />
    )
  }, [getDiffForEntry, selectedFile, handleSelectFile, handleStageAction, handleDiscardFile])

  return (
    <div data-testid="git-diff-panel" className="h-full flex flex-col">
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
        <div ref={splitContainerRef} className="flex-1 min-h-0 flex">
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
                <FileTree
                  items={stagedEntries}
                  getPath={getEntryPath}
                  compress
                  expandedFolders={expandedFolders}
                  onToggleFolder={toggleFolder}
                  renderFile={renderFileItem}
                />
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
                <FileTree
                  items={unstagedEntries}
                  getPath={getEntryPath}
                  compress
                  expandedFolders={expandedFolders}
                  onToggleFolder={toggleFolder}
                  renderFile={renderFileItem}
                />
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
