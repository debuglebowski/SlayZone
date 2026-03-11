import { useState, useEffect, useCallback, useRef } from 'react'
import { RefreshCw, Search, Loader2 } from 'lucide-react'
import { IconButton, Input, Switch, cn, toast } from '@slayzone/ui'
import type { DagCommit } from '../shared/types'
import { CommitGraph } from './CommitGraph'

const LIMIT_OPTIONS = [50, 100, 200, 500] as const

interface BranchesTabProps {
  projectPath: string | null
  visible: boolean
}

export function BranchesTab({ projectPath, visible }: BranchesTabProps) {
  const [showCommits, setShowCommits] = useState(true)
  const [commitLimit, setCommitLimit] = useState(200)
  const [dagCommits, setDagCommits] = useState<DagCommit[]>([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const initialLoad = useRef(false)

  const fetchData = useCallback(async () => {
    if (!projectPath) return
    try {
      const commits = await window.api.git.getCommitDag(projectPath, commitLimit)
      setDagCommits(commits)
    } catch { /* polling error */ }
  }, [projectPath, commitLimit])

  // Reset on project change
  useEffect(() => { initialLoad.current = false }, [projectPath])

  useEffect(() => {
    if (!visible || !projectPath) return
    if (!initialLoad.current) {
      setLoading(true)
      fetchData().finally(() => { setLoading(false); initialLoad.current = true })
    } else {
      fetchData()
    }
    const timer = setInterval(fetchData, 10000)
    return () => clearInterval(timer)
  }, [visible, projectPath, fetchData])

  const handleFetch = useCallback(async () => {
    if (!projectPath) return
    setFetching(true)
    try {
      await window.api.git.fetch(projectPath)
      await fetchData()
      toast('Fetched from remote')
    } catch {
      toast('Fetch failed')
    } finally {
      setFetching(false)
    }
  }, [projectPath, fetchData])

  if (!projectPath) {
    return <div className="p-4 text-xs text-muted-foreground">Set a project path to use Git features</div>
  }

  if (loading) {
    return <div className="h-full flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="shrink-0 p-3 pb-0">
        <div className="flex items-center gap-2">
          {/* Show all commits toggle */}
          <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer select-none">
            <Switch
              checked={showCommits}
              onCheckedChange={setShowCommits}
              className="scale-75"
            />
            All commits
          </label>

          {/* Commit limit */}
          <select
            value={commitLimit}
            onChange={(e) => { setCommitLimit(Number(e.target.value)); initialLoad.current = false }}
            className="h-6 text-[10px] rounded border bg-muted/50 px-1.5 text-foreground"
          >
            {LIMIT_OPTIONS.map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>

          {/* Filter */}
          <div className="flex-1 relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter..."
              className="h-7 text-xs pl-8"
            />
          </div>

          {/* Fetch */}
          <IconButton
            aria-label="Fetch"
            variant="ghost"
            className="h-7 w-7"
            title="Fetch from remote"
            onClick={handleFetch}
            disabled={fetching}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', fetching && 'animate-spin')} />
          </IconButton>
        </div>
      </div>

      {/* Graph */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        {dagCommits.length > 0 ? (
          <div className="rounded-lg border bg-muted/30 p-2">
            <CommitGraph
              mode="dag"
              commits={dagCommits}
              filterQuery={filter || undefined}
              tipsOnly={!showCommits}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-32 text-xs text-muted-foreground">
            {filter ? 'No matches' : 'No branches'}
          </div>
        )}
      </div>
    </div>
  )
}
