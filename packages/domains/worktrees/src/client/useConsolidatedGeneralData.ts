import { useState, useEffect, useCallback, useRef } from 'react'
import type { Task, UpdateTaskInput } from '@slayzone/task/shared'
import type { CommitInfo, AheadBehind, StatusSummary, DiffStatsSummary, WorktreeMetadata, GhPullRequest } from '../shared/types'
import type { GraphNode } from './BranchGraph'
import {
  DEFAULT_WORKTREE_BASE_PATH_TEMPLATE,
  joinWorktreePath,
  resolveWorktreeBasePathTemplate,
  slugify
} from './utils'
import { toast } from '@slayzone/ui'

export interface DetectedWorktreeItem {
  path: string
  branch: string | null
  isMain: boolean
}

export interface CopyFilesDialogState {
  open: boolean
  repoPath: string
  /** Pending worktree creation params — worktree doesn't exist yet */
  pendingWorktreePath: string
  pendingBranch: string
  pendingSourceBranch: string | null
}

export interface ConsolidatedGeneralData {
  // General data
  isGitRepo: boolean | null
  currentBranch: string | null
  worktreeBranch: string | null
  statusSummary: StatusSummary | null
  recentCommits: CommitInfo[]
  remoteUrl: string | null
  upstreamAB: AheadBehind | null

  // Branch/worktree data
  branchCommits: CommitInfo[]
  incomingCommits: CommitInfo[]
  preForkCommits: CommitInfo[]
  forkPoint: string | null
  taskBranch: string | null
  diffStats: DiffStatsSummary | null
  pr: GhPullRequest | null
  metadata: WorktreeMetadata | null
  graphNodes: GraphNode[]
  graphColumns: number
  branchLoading: boolean

  // Computed
  hasWorktree: boolean
  targetPath: string | null
  totalChanges: number
  parentBranch: string | null
  sluggedBranch: string

  // Actions
  handleAddWorktree: () => Promise<void>
  handleLinkWorktree: (worktreePath: string, branch: string | null) => Promise<void>
  handleRemoveWorktree: () => Promise<void>
  handleInitGit: () => Promise<void>
  handleAction: (action: string) => Promise<void>
  handleConfirmedAction: (action: string, label: string) => void
  handleCopyFilesConfirm: (selectedPaths: string[], remember: boolean) => Promise<void>
  handleCopyFilesCancel: () => void
  fetchGitData: () => Promise<void>

  // Detected worktrees for linking
  detectedWorktrees: DetectedWorktreeItem[]

  // Copy files dialog
  copyFilesDialog: CopyFilesDialogState

  // Action state
  creating: boolean
  initializing: boolean
  removing: boolean
  actionLoading: string | null
  createError: string | null
}

export function useConsolidatedGeneralData(
  task: Task,
  projectPath: string | null,
  visible: boolean,
  pollIntervalMs: number,
  onUpdateTask: (data: UpdateTaskInput) => Promise<Task>
): ConsolidatedGeneralData {
  const hasWorktree = !!task.worktree_path
  const targetPath = task.worktree_path ?? projectPath
  const parentBranch = task.worktree_parent_branch

  // General state
  const [isGitRepo, setIsGitRepo] = useState<boolean | null>(null)
  const [currentBranch, setCurrentBranch] = useState<string | null>(null)
  const [worktreeBranch, setWorktreeBranch] = useState<string | null>(null)
  const [statusSummary, setStatusSummary] = useState<StatusSummary | null>(null)
  const [recentCommits, setRecentCommits] = useState<CommitInfo[]>([])
  const [remoteUrl, setRemoteUrl] = useState<string | null>(null)
  const [upstreamAB, setUpstreamAB] = useState<AheadBehind | null>(null)
  const [initializing, setInitializing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [detectedWorktrees, setDetectedWorktrees] = useState<DetectedWorktreeItem[]>([])
  const [copyFilesDialog, setCopyFilesDialog] = useState<CopyFilesDialogState>({ open: false, repoPath: '', pendingWorktreePath: '', pendingBranch: '', pendingSourceBranch: null })
  const copyFilesDialogRef = useRef(copyFilesDialog)
  copyFilesDialogRef.current = copyFilesDialog

  // Branch state
  const [branchCommits, setBranchCommits] = useState<CommitInfo[]>([])
  const [incomingCommits, setIncomingCommits] = useState<CommitInfo[]>([])
  const [preForkCommits, setPreForkCommits] = useState<CommitInfo[]>([])
  const [forkPoint, setForkPoint] = useState<string | null>(null)
  const [taskBranch, setTaskBranch] = useState<string | null>(null)
  const [diffStats, setDiffStats] = useState<DiffStatsSummary | null>(null)
  const [pr, setPr] = useState<GhPullRequest | null>(null)
  const [metadata, setMetadata] = useState<WorktreeMetadata | null>(null)
  const [branchLoading, setBranchLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const initialLoad = useRef(false)


  // Fetch general git data
  const fetchGitData = useCallback(async () => {
    if (!projectPath) return
    try {
      const isRepo = await window.api.git.isGitRepo(projectPath)
      setIsGitRepo(isRepo)
      if (!isRepo) return

      const [branch, remote] = await Promise.all([
        window.api.git.getCurrentBranch(projectPath),
        window.api.git.getRemoteUrl(projectPath)
      ])
      setCurrentBranch(branch)
      setRemoteUrl(remote)

      if (targetPath) {
        const activeBranch = hasWorktree ? worktreeBranch : branch
        const [status, commits, uab] = await Promise.all([
          window.api.git.getStatusSummary(targetPath),
          window.api.git.getRecentCommits(targetPath, 40),
          activeBranch ? window.api.git.getAheadBehindUpstream(targetPath, activeBranch) : Promise.resolve(null)
        ])
        setStatusSummary(status)
        setRecentCommits(commits)
        setUpstreamAB(uab)
      }
    } catch { /* polling error */ }
  }, [projectPath, targetPath, hasWorktree, worktreeBranch])

  // Fetch branch comparison data
  const fetchBranchData = useCallback(async () => {
    if (!targetPath || !parentBranch) return
    try {
      const branch = await window.api.git.getCurrentBranch(targetPath)
      setTaskBranch(branch)
      if (!branch) return

      const mergeBase = await window.api.git.getMergeBase(
        projectPath || targetPath,
        branch,
        parentBranch
      )
      setForkPoint(mergeBase)

      if (mergeBase) {
        const repoPath = projectPath || targetPath
        const [yours, incoming, preFork, stats] = await Promise.all([
          window.api.git.getCommitsSince(targetPath, mergeBase, branch),
          window.api.git.getCommitsSince(repoPath, mergeBase, parentBranch),
          window.api.git.getCommitsBeforeRef(repoPath, mergeBase, 3),
          window.api.git.getDiffStats(targetPath, parentBranch)
        ])
        setBranchCommits(yours)
        setIncomingCommits(incoming)
        setPreForkCommits(preFork)
        setDiffStats(stats)
      } else {
        setBranchCommits([])
        setIncomingCommits([])
        setPreForkCommits([])
        setDiffStats(null)
      }
    } catch { /* polling error */ }
  }, [targetPath, projectPath, parentBranch])

  // Worktree branch
  useEffect(() => {
    if (!task.worktree_path) { setWorktreeBranch(null); return }
    window.api.git.getCurrentBranch(task.worktree_path).then(setWorktreeBranch).catch(() => setWorktreeBranch(null))
  }, [task.worktree_path])

  // Poll general data
  useEffect(() => {
    if (!visible || !projectPath) return
    fetchGitData()
    const timer = setInterval(fetchGitData, pollIntervalMs)
    return () => clearInterval(timer)
  }, [visible, projectPath, pollIntervalMs, fetchGitData])

  // Poll branch data
  useEffect(() => {
    if (!visible || !targetPath || !parentBranch) return
    if (!initialLoad.current) {
      setBranchLoading(true)
      fetchBranchData().finally(() => { setBranchLoading(false); initialLoad.current = true })
    } else {
      fetchBranchData()
    }
    const timer = setInterval(fetchBranchData, pollIntervalMs)
    return () => clearInterval(timer)
  }, [visible, targetPath, parentBranch, fetchBranchData, pollIntervalMs])

  // PR — reactive fetch when pr_url or branch changes
  const activeBranch = hasWorktree ? worktreeBranch : currentBranch
  useEffect(() => {
    const repoPath = projectPath || targetPath
    if (!repoPath) return
    if (task.pr_url) {
      window.api.git.getPrByUrl(repoPath, task.pr_url).then(setPr).catch(() => setPr(null))
    } else if (activeBranch) {
      window.api.git.listOpenPrs(repoPath)
        .then(prs => setPr(prs.find(p => p.headRefName === activeBranch) ?? null))
        .catch(() => setPr(null))
    }
  }, [task.pr_url, activeBranch, projectPath, targetPath])

  // Metadata — one-time per worktree path
  useEffect(() => {
    if (!task.worktree_path) return
    window.api.git.getWorktreeMetadata(task.worktree_path)
      .then(setMetadata).catch(() => setMetadata(null))
  }, [task.worktree_path])

  // Reset on path change
  useEffect(() => {
    initialLoad.current = false
  }, [targetPath])

  // Actions
  const handleInitGit = useCallback(async () => {
    if (!projectPath) return
    setInitializing(true)
    try {
      await window.api.git.init(projectPath)
      setIsGitRepo(true)
      const branch = await window.api.git.getCurrentBranch(projectPath)
      setCurrentBranch(branch)
    } catch { /* ignore */ }
    finally { setInitializing(false) }
  }, [projectPath])

  /** Resolve worktree path params (shared by direct create and ask-dialog flows) */
  const resolveWorktreeParams = useCallback(async () => {
    if (!projectPath) return null
    const basePathTemplate = (await window.api.settings.get('worktree_base_path')) || DEFAULT_WORKTREE_BASE_PATH_TEMPLATE
    const basePath = resolveWorktreeBasePathTemplate(basePathTemplate, projectPath)
    const branch = slugify(task.title) || `task-${task.id.slice(0, 8)}`
    const worktreePath = joinWorktreePath(basePath, branch)
    return { branch, worktreePath }
  }, [projectPath, task.title, task.id])

  /** Create worktree (no auto-copy), optionally copy specific files, then link to task */
  const createWorktreeAndLink = useCallback(async (
    worktreePath: string,
    branch: string,
    filesToCopy?: string[]
  ) => {
    if (!projectPath) return
    // Omit projectId so server skips copy resolution — we handle it here
    await window.api.git.createWorktree({
      repoPath: projectPath, targetPath: worktreePath, branch
    })
    if (filesToCopy && filesToCopy.length > 0) {
      await window.api.git.copyIgnoredFiles(projectPath, worktreePath, filesToCopy)
    }
    await onUpdateTask({ id: task.id, worktreePath, worktreeParentBranch: currentBranch })
  }, [projectPath, task.id, currentBranch, onUpdateTask])

  const handleAddWorktree = useCallback(async () => {
    if (!projectPath) return
    setCreateError(null)
    try {
      const params = await resolveWorktreeParams()
      if (!params) return

      // Check copy behavior before creating
      const { behavior } = await window.api.git.resolveCopyBehavior(task.project_id)
      if (behavior === 'ask') {
        // Show dialog — worktree created on confirm
        setCopyFilesDialog({
          open: true, repoPath: projectPath,
          pendingWorktreePath: params.worktreePath,
          pendingBranch: params.branch,
          pendingSourceBranch: currentBranch
        })
        return
      }

      // Non-ask: create immediately (server handles copy for all/custom/none)
      setCreating(true)
      await window.api.git.createWorktree({
        repoPath: projectPath, targetPath: params.worktreePath, branch: params.branch,
        projectId: task.project_id
      })
      await onUpdateTask({ id: task.id, worktreePath: params.worktreePath, worktreeParentBranch: currentBranch })
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : String(err))
    } finally {
      setCreating(false)
    }
  }, [projectPath, task.id, task.project_id, currentBranch, onUpdateTask, resolveWorktreeParams])

  const handleCopyFilesConfirm = useCallback(async (selectedPaths: string[], remember: boolean) => {
    const pending = copyFilesDialogRef.current
    setCopyFilesDialog(prev => ({ ...prev, open: false }))

    // Create the worktree now + copy selected files + link task
    setCreating(true)
    setCreateError(null)
    try {
      await createWorktreeAndLink(pending.pendingWorktreePath, pending.pendingBranch, selectedPaths)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : String(err))
    } finally {
      setCreating(false)
    }

    // Persist selection if "remember" checked
    if (remember && task.project_id) {
      try {
        if (selectedPaths.length === 0) {
          await window.api.db.updateProject({ id: task.project_id, worktreeCopyBehavior: 'none' })
        } else {
          await window.api.db.updateProject({
            id: task.project_id,
            worktreeCopyBehavior: 'custom',
            // Paths must not contain commas
            worktreeCopyPaths: selectedPaths.join(', ')
          })
        }
      } catch { /* best-effort */ }
    }
  }, [task.project_id, createWorktreeAndLink])

  const handleCopyFilesCancel = useCallback(() => {
    setCopyFilesDialog(prev => ({ ...prev, open: false }))
  }, [])

  const handleLinkWorktree = useCallback(async (worktreePath: string, _branch: string | null) => {
    try {
      const parentBranchVal = currentBranch
      await onUpdateTask({ id: task.id, worktreePath, worktreeParentBranch: parentBranchVal })
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : String(err))
    }
  }, [task.id, currentBranch, onUpdateTask])

  const handleRemoveWorktree = useCallback(async () => {
    if (!projectPath || !task.worktree_path) return
    setRemoving(true)
    try {
      await window.api.git.removeWorktree(projectPath, task.worktree_path)
      await onUpdateTask({ id: task.id, worktreePath: null, worktreeParentBranch: null })
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to remove worktree')
    } finally {
      setRemoving(false)
    }
  }, [projectPath, task.id, task.worktree_path, onUpdateTask])

  // Fetch detected worktrees when no worktree is linked
  useEffect(() => {
    if (hasWorktree || !projectPath) { setDetectedWorktrees([]); return }
    window.api.git.detectWorktrees(projectPath)
      .then(wts => setDetectedWorktrees(wts.filter(w => !w.isMain)))
      .catch(() => setDetectedWorktrees([]))
  }, [hasWorktree, projectPath])

  const handleAction = useCallback(async (action: string) => {
    if (!targetPath || !parentBranch || !taskBranch) return
    setActionLoading(action)
    try {
      if (action === 'rebase') {
        const result = await window.api.git.rebaseOnto(targetPath, parentBranch)
        if (result.success) { toast('Rebase complete'); fetchBranchData() }
        else if (result.conflicted) toast(result.error ?? 'Rebase has conflicts')
        else toast(result.error ?? 'Rebase failed')
      } else if (action === 'merge') {
        const result = await window.api.git.mergeFrom(targetPath, parentBranch)
        if (result.success) { toast(`Merged ${parentBranch}`); fetchBranchData() }
        else if (result.conflicted) toast(result.error ?? 'Merge has conflicts')
        else toast(result.error ?? 'Merge failed')
      } else if (action === 'push') {
        const result = await window.api.git.push(targetPath, taskBranch)
        toast(result.success ? 'Pushed' : (result.error ?? 'Push failed'))
      } else if (action === 'pull') {
        const result = await window.api.git.pull(targetPath)
        if (result.success) { toast('Pulled'); fetchBranchData() }
        else toast(result.error ?? 'Pull failed')
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setActionLoading(null)
    }
  }, [targetPath, parentBranch, taskBranch, fetchBranchData])

  const handleConfirmedAction = useCallback((action: string, label: string) => {
    toast(`${label}?`, {
      action: { label: 'Confirm', onClick: () => handleAction(action) }
    })
  }, [handleAction])

  // Build graph nodes
  const graphNodes: GraphNode[] = []

  if (hasWorktree && parentBranch && forkPoint) {
    if (incomingCommits.length > 0) {
      for (let i = 0; i < incomingCommits.length; i++) {
        graphNodes.push({
          commit: incomingCommits[i],
          column: 0,
          type: i === 0 ? 'branch-tip' : 'commit',
          branchName: parentBranch,
          branchLabel: i === 0 ? parentBranch : undefined
        })
      }
    } else {
      graphNodes.push({
        commit: { hash: forkPoint, shortHash: forkPoint.slice(0, 7), message: 'Up to date', author: '', relativeDate: '' },
        column: 0,
        type: 'branch-tip',
        branchName: parentBranch,
        branchLabel: parentBranch
      })
    }

    if (branchCommits.length > 0) {
      for (let i = 0; i < branchCommits.length; i++) {
        graphNodes.push({
          commit: branchCommits[i],
          column: 1,
          type: i === 0 ? 'branch-tip' : 'commit',
          branchName: taskBranch ?? undefined,
          branchLabel: i === 0 ? (taskBranch ?? 'HEAD') : undefined
        })
      }
    } else {
      const statusMsg = diffStats && diffStats.filesChanged > 0
        ? `${diffStats.filesChanged} file${diffStats.filesChanged !== 1 ? 's' : ''} changed (uncommitted)`
        : 'No changes yet'
      graphNodes.push({
        commit: { hash: forkPoint, shortHash: forkPoint.slice(0, 7), message: statusMsg, author: '', relativeDate: '' },
        column: 1,
        type: 'branch-tip',
        branchName: taskBranch ?? undefined,
        branchLabel: taskBranch ?? 'HEAD'
      })
    }

    graphNodes.push({
      commit: { hash: forkPoint, shortHash: forkPoint.slice(0, 7), message: 'fork point', author: '', relativeDate: '' },
      column: 0,
      type: 'fork-point'
    })

    for (const c of preForkCommits) {
      graphNodes.push({ commit: c, column: 0, type: 'commit' })
    }
  }

  const graphColumns = forkPoint ? 2 : (incomingCommits.length > 0 ? 2 : 1)

  const totalChanges = statusSummary ? statusSummary.staged + statusSummary.unstaged + statusSummary.untracked : 0

  return {
    isGitRepo, currentBranch, worktreeBranch, statusSummary, recentCommits,
    remoteUrl, upstreamAB, branchCommits, incomingCommits, preForkCommits,
    forkPoint, taskBranch, diffStats, pr, metadata, graphNodes, graphColumns,
    branchLoading, hasWorktree, targetPath, totalChanges, parentBranch,
    sluggedBranch: slugify(task.title) || `task-${task.id.slice(0, 8)}`,
    handleAddWorktree, handleLinkWorktree, handleRemoveWorktree, handleInitGit,
    handleAction, handleConfirmedAction, handleCopyFilesConfirm, handleCopyFilesCancel, fetchGitData,
    detectedWorktrees, copyFilesDialog,
    creating, initializing, removing, actionLoading, createError
  }
}
