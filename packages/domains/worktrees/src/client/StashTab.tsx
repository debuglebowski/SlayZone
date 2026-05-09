import { useEffect, useMemo, useState, forwardRef, useImperativeHandle } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTRPC } from '@slayzone/transport/client'
import { Archive, FileText } from 'lucide-react'
import { cn, PulseGrid } from '@slayzone/ui'
import { useGitPanelContext } from './UnifiedGitPanel'
import { parseUnifiedDiff, type FileDiff } from './parse-diff'
import { DiffView } from './DiffView'

interface StashTabProps {
  visible: boolean
  pollIntervalMs?: number
  showAll: boolean
}

export interface StashTabHandle {
  refresh: () => void
}

function formatAge(createdAt: number): string {
  if (!createdAt) return ''
  const now = Date.now() / 1000
  const diff = Math.max(0, now - createdAt)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d`
  return `${Math.floor(diff / (86400 * 30))}mo`
}

export const StashTab = forwardRef<StashTabHandle, StashTabProps>(function StashTab({ visible, pollIntervalMs = 5000, showAll }, ref) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { projectPath, activeTask } = useGitPanelContext()
  const repoPath = activeTask?.worktree_path ?? projectPath

  const stashesQuery = useQuery({
    ...trpc.worktrees.listStashes.queryOptions({ repoPath: repoPath ?? '' }),
    enabled: visible && !!repoPath,
    refetchInterval: visible ? pollIntervalMs : false,
  })
  const branchQuery = useQuery({
    ...trpc.worktrees.getCurrentBranch.queryOptions({ path: repoPath ?? '' }),
    enabled: visible && !!repoPath,
    refetchInterval: visible ? pollIntervalMs : false,
  })

  const stashes = stashesQuery.data ?? []
  const currentBranch = branchQuery.data ?? null
  const loading = stashesQuery.isLoading

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  // Keep selectedIndex valid when stashes change
  useEffect(() => {
    setSelectedIndex((prev) => {
      if (stashes.length === 0) return null
      if (prev === null) return stashes[0].index
      return stashes.some((s) => s.index === prev) ? prev : stashes[0].index
    })
  }, [stashes])

  useImperativeHandle(ref, () => ({
    refresh: () => {
      queryClient.invalidateQueries({ queryKey: trpc.worktrees.listStashes.queryKey() })
      queryClient.invalidateQueries({ queryKey: trpc.worktrees.getCurrentBranch.queryKey() })
    }
  }), [queryClient, trpc])

  const filteredStashes = useMemo(() => {
    if (showAll || !currentBranch) return stashes
    return stashes.filter((s) => s.branch === currentBranch)
  }, [stashes, showAll, currentBranch])

  const selected = useMemo(
    () => stashes.find((s) => s.index === selectedIndex) ?? null,
    [stashes, selectedIndex]
  )

  const stashDiffQuery = useQuery({
    ...trpc.worktrees.getStashDiff.queryOptions({ repoPath: repoPath ?? '', index: selected?.index ?? 0 }),
    enabled: !!repoPath && selected !== null,
  })
  const diff: FileDiff[] = useMemo(() => stashDiffQuery.data ? parseUnifiedDiff(stashDiffQuery.data) : [], [stashDiffQuery.data])
  const diffLoading = stashDiffQuery.isLoading

  if (!repoPath) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
        No repository
      </div>
    )
  }

  const isEmpty = !loading && filteredStashes.length === 0

  if (loading && stashes.length === 0) {
    return <PulseGrid />
  }

  if (isEmpty) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <Archive className="h-14 w-14 text-white" />
        <div className="text-base text-muted-foreground">
          {stashes.length > 0 ? 'No stashes on this branch' : 'No stashes'}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex">
      {/* List */}
      <div className="w-80 shrink-0 border-r overflow-y-auto">
        {filteredStashes.map((entry) => (
          <div
            key={entry.sha}
            className={cn(
              'px-3 py-2 border-b cursor-pointer hover:bg-accent/50',
              entry.index === selectedIndex && 'bg-accent'
            )}
            onClick={() => setSelectedIndex(entry.index)}
          >
            <div className="text-xs font-medium truncate">{entry.message}</div>
            <div className="text-[10px] text-muted-foreground font-mono truncate">
              stash@{`{${entry.index}}`} · {entry.branch} · {formatAge(entry.createdAt)}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2">
              <span>{entry.filesChanged} file{entry.filesChanged === 1 ? '' : 's'}</span>
              {entry.insertions > 0 && <span className="text-green-600 dark:text-green-400">+{entry.insertions}</span>}
              {entry.deletions > 0 && <span className="text-red-600 dark:text-red-400">-{entry.deletions}</span>}
              {entry.includesUntracked && <span className="text-blue-500">untracked</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Preview */}
      <div className="flex-1 min-w-0 flex flex-col">
        {selected ? (
          <>
            <div className="shrink-0 px-4 py-2 border-b">
              <div className="text-xs font-medium truncate">{selected.message}</div>
              <div className="text-[10px] text-muted-foreground font-mono">
                stash@{`{${selected.index}}`} · {selected.branch} · {formatAge(selected.createdAt)}
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-auto font-mono text-xs">
              {diffLoading ? (
                <PulseGrid />
              ) : diff.length === 0 ? (
                <div className="p-4 text-muted-foreground">No changes</div>
              ) : (
                diff.map((fd) => (
                  <div key={fd.path} className="border-b">
                    <div className="px-4 py-1.5 bg-muted/30 text-[11px] flex items-center gap-2">
                      <FileText className="h-3 w-3" />
                      <span className="truncate">{fd.path}</span>
                    </div>
                    <DiffView diff={fd} />
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
            Select a stash
          </div>
        )}
      </div>
    </div>
  )
})
