import { useState, useEffect, useCallback, useRef } from 'react'
import {
  ExternalLink,
  GitPullRequest,
  Link2,
  Plus,
  Loader2,
  Unlink,
  AlertTriangle,
  ChevronDown,
  Check,
  CircleDot,
  GitMerge,
  CircleX,
  CheckCircle2,
  XCircle,
  Clock,
  MessageSquare,
  Send,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  RefreshCw,
  Eye
} from 'lucide-react'
import {
  Button,
  IconButton,
  Input,
  Checkbox,
  cn,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@slayzone/ui'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Task, UpdateTaskInput } from '@slayzone/task/shared'
import type { GhPullRequest, GhPrComment } from '../shared/types'

interface PullRequestTabProps {
  task: Task
  projectPath: string | null
  visible: boolean
  onUpdateTask: (data: UpdateTaskInput) => Promise<Task>
  onTaskUpdated: (task: Task) => void
}

type View = 'idle' | 'create' | 'link'

export function PullRequestTab({ task, projectPath, visible, onUpdateTask, onTaskUpdated }: PullRequestTabProps) {
  const [ghInstalled, setGhInstalled] = useState<boolean | null>(null)
  const [pr, setPr] = useState<GhPullRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('idle')
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined)

  // Check gh + fetch PR if linked
  useEffect(() => {
    if (!visible || !projectPath) return
    let cancelled = false
    ;(async () => {
      try {
        const installed = await window.api.git.checkGhInstalled()
        if (cancelled) return
        setGhInstalled(installed)
        if (!installed) { setLoading(false); return }

        if (task.pr_url) {
          const data = await window.api.git.getPrByUrl(projectPath, task.pr_url)
          if (!cancelled) setPr(data)
        }
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [visible, projectPath, task.pr_url])

  // Poll PR status when linked
  useEffect(() => {
    if (!visible || !projectPath || !task.pr_url || !ghInstalled) return
    pollRef.current = setInterval(async () => {
      try {
        const data = await window.api.git.getPrByUrl(projectPath, task.pr_url!)
        if (data) setPr(data)
      } catch { /* ignore */ }
    }, 30000)
    return () => clearInterval(pollRef.current)
  }, [visible, projectPath, task.pr_url, ghInstalled])

  const handleUnlink = useCallback(async () => {
    const updated = await onUpdateTask({ id: task.id, prUrl: null })
    onTaskUpdated(updated)
    setPr(null)
    setView('idle')
  }, [task.id, onUpdateTask, onTaskUpdated])

  const handleLinkPr = useCallback(async (url: string) => {
    setError(null)
    try {
      const updated = await onUpdateTask({ id: task.id, prUrl: url })
      onTaskUpdated(updated)
      if (projectPath) {
        const data = await window.api.git.getPrByUrl(projectPath, url)
        setPr(data)
      }
      setView('idle')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [task.id, projectPath, onUpdateTask, onTaskUpdated])

  const handleCreated = useCallback(async (url: string) => {
    const updated = await onUpdateTask({ id: task.id, prUrl: url })
    onTaskUpdated(updated)
    if (projectPath) {
      const data = await window.api.git.getPrByUrl(projectPath, url)
      setPr(data)
    }
    setView('idle')
  }, [task.id, projectPath, onUpdateTask, onTaskUpdated])

  if (!projectPath) {
    return <EmptyMessage>Set a project path to use PR features</EmptyMessage>
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (ghInstalled === false) {
    return (
      <div className="p-6 space-y-3">
        <div className="flex items-center gap-2 text-yellow-500">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm font-medium">GitHub CLI not found</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Install the GitHub CLI to create and manage pull requests:
        </p>
        <code className="block text-xs bg-muted px-3 py-2 rounded-md">
          brew install gh && gh auth login
        </code>
      </div>
    )
  }

  // PR is linked — show status
  if (task.pr_url && pr) {
    return <LinkedPrView pr={pr} projectPath={projectPath!} visible={visible} onUnlink={handleUnlink} />
  }
  if (task.pr_url && !pr) {
    return (
      <div className="p-6 space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <GitPullRequest className="h-4 w-4 text-muted-foreground" />
          <a
            className="text-primary hover:underline truncate"
            href="#"
            onClick={(e) => { e.preventDefault(); window.api.shell.openExternal(task.pr_url!) }}
          >
            {task.pr_url}
          </a>
        </div>
        <Button variant="outline" size="sm" onClick={handleUnlink} className="gap-2">
          <Unlink className="h-3.5 w-3.5" /> Unlink
        </Button>
      </div>
    )
  }

  // No PR linked
  if (view === 'create') {
    return (
      <CreatePrForm
        task={task}
        projectPath={projectPath}
        onCreated={handleCreated}
        onCancel={() => setView('idle')}
      />
    )
  }

  if (view === 'link') {
    return (
      <LinkPrView
        projectPath={projectPath}
        onLink={handleLinkPr}
        onCancel={() => setView('idle')}
        error={error}
      />
    )
  }

  return (
    <div className="h-full flex items-center justify-center">
      <div className="space-y-3 text-center">
        <GitPullRequest className="h-8 w-8 text-muted-foreground mx-auto" />
        <p className="text-sm text-muted-foreground">No pull request linked</p>
        <div className="flex gap-2 justify-center">
          <Button variant="outline" size="sm" onClick={() => setView('create')} className="gap-2">
            <Plus className="h-3.5 w-3.5" /> Create PR
          </Button>
          <Button variant="outline" size="sm" onClick={() => setView('link')} className="gap-2">
            <Link2 className="h-3.5 w-3.5" /> Link Existing
          </Button>
        </div>
      </div>
    </div>
  )
}

// --- Linked PR view ---

function LinkedPrView({ pr, projectPath, visible, onUnlink }: {
  pr: GhPullRequest
  projectPath: string
  visible: boolean
  onUnlink: () => void
}) {
  const [comments, setComments] = useState<GhPrComment[]>([])
  const [loadingComments, setLoadingComments] = useState(true)
  const [commentBody, setCommentBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [commentError, setCommentError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const fetchComments = useCallback(async () => {
    try {
      const data = await window.api.git.getPrComments(projectPath, pr.number)
      setComments(data)
    } catch { /* ignore */ }
    setLoadingComments(false)
  }, [projectPath, pr.number])

  useEffect(() => {
    if (!visible) return
    fetchComments()
    const timer = setInterval(fetchComments, 30000)
    return () => clearInterval(timer)
  }, [visible, fetchComments])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [comments.length])

  // Auto-grow textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCommentBody(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentBody.trim()) return
    setSubmitting(true)
    setCommentError(null)
    try {
      await window.api.git.addPrComment(projectPath, pr.number, commentBody.trim())
      setCommentBody('')
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
      await fetchComments()
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'Failed to post comment')
    }
    setSubmitting(false)
  }

  const [unlinkOpen, setUnlinkOpen] = useState(false)

  return (
    <div className="h-full flex flex-col bg-surface-1">
      {/* Header */}
      <div className="shrink-0 px-4 py-6 border-b space-y-2.5">
        {/* Title row: icon | title #number | pills | action icons */}
        <div className="flex items-start gap-2.5">
          <PrStateIcon state={pr.state} isDraft={pr.isDraft} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium leading-snug">
              {pr.title} <span className="text-xs text-muted-foreground font-normal">#{pr.number}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground">
              <span className="font-mono">{pr.headRefName}</span>
              <span>→</span>
              <span className="font-mono">{pr.baseRefName}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <PrStateBadge state={pr.state} isDraft={pr.isDraft} />
            {pr.statusCheckRollup && <ChecksBadge status={pr.statusCheckRollup} />}
            {pr.reviewDecision && <ReviewBadge decision={pr.reviewDecision} />}
            <div className="w-5" />
            <Tooltip>
              <TooltipTrigger asChild>
                <IconButton aria-label="Refresh" variant="ghost" className="h-6 w-6" onClick={fetchComments}>
                  <RefreshCw className="h-3 w-3" />
                </IconButton>
              </TooltipTrigger>
              <TooltipContent side="bottom">Refresh</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <IconButton aria-label="Open in browser" variant="ghost" className="h-6 w-6" onClick={() => window.api.shell.openExternal(pr.url)}>
                  <ExternalLink className="h-3 w-3" />
                </IconButton>
              </TooltipTrigger>
              <TooltipContent side="bottom">Open in browser</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <IconButton aria-label="Unlink PR" variant="ghost" className="h-6 w-6" onClick={() => setUnlinkOpen(true)}>
                  <Unlink className="h-3 w-3" />
                </IconButton>
              </TooltipTrigger>
              <TooltipContent side="bottom">Unlink PR</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Unlink confirmation */}
      <AlertDialog open={unlinkOpen} onOpenChange={setUnlinkOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlink Pull Request</AlertDialogTitle>
            <AlertDialogDescription>
              Remove the link between this task and PR #{pr.number}? The pull request itself won't be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setUnlinkOpen(false); onUnlink() }}>Unlink</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Timeline */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
        {loadingComments ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : comments.length === 0 ? (
          <div className="py-10 text-center">
            <MessageSquare className="h-6 w-6 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground/60">No activity yet</p>
          </div>
        ) : (
          <div className="relative px-4 py-3">
            {/* Timeline connector line */}
            <div className="absolute left-[27px] top-3 bottom-3 w-px bg-border" />

            <div className="space-y-0.5">
              {comments.map((comment) => (
                <TimelineItem key={comment.id} comment={comment} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Comment input */}
      <div className="shrink-0 border-t">
        <form onSubmit={handleSubmitComment} className="p-3">
          <div className="rounded-lg border bg-surface-2 focus-within:ring-1 focus-within:ring-ring transition-shadow">
            <textarea
              ref={textareaRef}
              value={commentBody}
              onChange={handleTextareaChange}
              placeholder="Leave a comment..."
              rows={2}
              className="block w-full bg-transparent px-3 pt-2.5 pb-1 text-xs resize-none focus:outline-none min-h-[52px] placeholder:text-muted-foreground/50"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  handleSubmitComment(e)
                }
              }}
            />
            {commentError && (
              <div className="px-3 pt-1.5">
                <p className="text-[11px] text-destructive">{commentError}</p>
              </div>
            )}
            <div className="flex items-center justify-between px-3 py-1.5">
              <span className="text-[10px] text-muted-foreground/50">Markdown supported</span>
              <Button
                type="submit"
                size="sm"
                disabled={submitting || !commentBody.trim()}
                className="h-6 px-2.5 text-[11px] gap-1.5"
              >
                {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                Comment
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// --- Timeline item ---

function TimelineItem({ comment }: { comment: GhPrComment }) {
  const isReviewAction = comment.type === 'review' && !comment.body
  const timeAgo = formatRelativeTime(comment.createdAt)

  if (isReviewAction) {
    return (
      <div className="relative flex items-center gap-3 py-2">
        <div className="relative z-10 shrink-0">
          <ReviewEventDot state={comment.reviewState} />
        </div>
        <span className="text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground/80">{comment.author}</span>
          {' '}{reviewActionLabel(comment.reviewState)}
          <span className="ml-1.5 text-muted-foreground/60">{timeAgo}</span>
        </span>
      </div>
    )
  }

  return (
    <div className="relative flex gap-3 py-1.5">
      {/* Avatar */}
      <div className="relative z-10 shrink-0">
        <AuthorAvatar name={comment.author} />
      </div>

      {/* Comment card */}
      <div className="flex-1 min-w-0 rounded-lg border bg-surface-2 overflow-hidden">
        {/* Comment header */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/30 border-b">
          <span className="text-[11px] font-semibold">{comment.author}</span>
          {comment.type === 'review' && comment.reviewState && (
            <ReviewInlineBadge state={comment.reviewState} />
          )}
          <span className="text-[10px] text-muted-foreground/60">{timeAgo}</span>
        </div>

        {/* Comment body — rendered as markdown */}
        <div className="px-3 py-2 text-xs">
          <div className="prose prose-sm dark:prose-invert max-w-none
            [&>*:first-child]:mt-0 [&>*:last-child]:mb-0
            prose-p:my-1.5 prose-p:leading-relaxed
            prose-pre:my-2 prose-pre:text-[11px] prose-pre:rounded-md
            prose-code:text-[11px] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:bg-muted
            prose-a:text-primary prose-a:no-underline hover:prose-a:underline
            prose-blockquote:border-l-2 prose-blockquote:pl-3 prose-blockquote:text-muted-foreground prose-blockquote:my-2
            prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5
            prose-img:rounded-md prose-img:my-2"
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{comment.body}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  )
}

// --- Avatar ---

const avatarColors = [
  'bg-blue-500/20 text-blue-400',
  'bg-purple-500/20 text-purple-400',
  'bg-green-500/20 text-green-400',
  'bg-orange-500/20 text-orange-400',
  'bg-pink-500/20 text-pink-400',
  'bg-cyan-500/20 text-cyan-400',
  'bg-yellow-500/20 text-yellow-400',
  'bg-red-500/20 text-red-400',
]

function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0
  return avatarColors[Math.abs(hash) % avatarColors.length]
}

function AuthorAvatar({ name }: { name: string }) {
  const initials = name.slice(0, 2).toUpperCase()
  return (
    <div className={cn(
      'h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold select-none',
      avatarColor(name)
    )}>
      {initials}
    </div>
  )
}

// --- Review event dot ---

function ReviewEventDot({ state }: { state?: string }) {
  const base = 'h-6 w-6 rounded-full flex items-center justify-center'
  switch (state) {
    case 'APPROVED':
      return <div className={cn(base, 'bg-green-500/15')}><CheckCircle2 className="h-3.5 w-3.5 text-green-500" /></div>
    case 'CHANGES_REQUESTED':
      return <div className={cn(base, 'bg-red-500/15')}><XCircle className="h-3.5 w-3.5 text-red-500" /></div>
    case 'COMMENTED':
      return <div className={cn(base, 'bg-muted')}><Eye className="h-3.5 w-3.5 text-muted-foreground" /></div>
    default:
      return <div className={cn(base, 'bg-muted')}><MessageSquare className="h-3.5 w-3.5 text-muted-foreground" /></div>
  }
}

function reviewActionLabel(state?: string): string {
  switch (state) {
    case 'APPROVED': return 'approved these changes'
    case 'CHANGES_REQUESTED': return 'requested changes'
    case 'COMMENTED': return 'left a review'
    case 'DISMISSED': return 'dismissed a review'
    default: return 'reviewed'
  }
}

function ReviewInlineBadge({ state }: { state: string }) {
  const config: Record<string, { label: string; className: string }> = {
    APPROVED: { label: 'Approved', className: 'text-green-500 bg-green-500/10 border-green-500/20' },
    CHANGES_REQUESTED: { label: 'Changes requested', className: 'text-red-500 bg-red-500/10 border-red-500/20' },
    COMMENTED: { label: 'Reviewed', className: 'text-muted-foreground bg-muted border-border' }
  }
  const c = config[state]
  if (!c) return null
  return (
    <span className={cn('px-1.5 py-px rounded text-[9px] font-medium border', c.className)}>
      {c.label}
    </span>
  )
}

// --- Status badges ---

function ChecksBadge({ status }: { status: GhPullRequest['statusCheckRollup'] }) {
  if (!status) return null
  const config: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
    SUCCESS: { icon: <CheckCircle2 className="h-3 w-3" />, label: 'Checks pass', className: 'text-green-500 bg-green-500/10' },
    FAILURE: { icon: <XCircle className="h-3 w-3" />, label: 'Checks failing', className: 'text-red-500 bg-red-500/10' },
    PENDING: { icon: <Clock className="h-3 w-3" />, label: 'Checks running', className: 'text-yellow-500 bg-yellow-500/10' }
  }
  const c = config[status]
  if (!c) return null
  return (
    <span className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium', c.className)}>
      {c.icon} {c.label}
    </span>
  )
}

function ReviewBadge({ decision }: { decision: GhPullRequest['reviewDecision'] }) {
  if (!decision) return null
  const config: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
    APPROVED: { icon: <ShieldCheck className="h-3 w-3" />, label: 'Approved', className: 'text-green-500 bg-green-500/10' },
    CHANGES_REQUESTED: { icon: <ShieldAlert className="h-3 w-3" />, label: 'Changes requested', className: 'text-red-500 bg-red-500/10' },
    REVIEW_REQUIRED: { icon: <ShieldQuestion className="h-3 w-3" />, label: 'Review required', className: 'text-yellow-500 bg-yellow-500/10' }
  }
  const c = config[decision]
  if (!c) return null
  return (
    <span className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium', c.className)}>
      {c.icon} {c.label}
    </span>
  )
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 30) return `${diffDays}d ago`
  return new Date(dateStr).toLocaleDateString()
}

// --- Create PR form ---

function CreatePrForm({ task, projectPath, onCreated, onCancel }: {
  task: Task
  projectPath: string
  onCreated: (url: string) => void
  onCancel: () => void
}) {
  const targetPath = task.worktree_path ?? projectPath
  const [title, setTitle] = useState(task.title)
  const [body, setBody] = useState('')
  const [baseBranch, setBaseBranch] = useState(task.worktree_parent_branch ?? '')
  const [draft, setDraft] = useState(false)
  const [branches, setBranches] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showBranches, setShowBranches] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const list = await window.api.git.listBranches(projectPath)
        setBranches(list)
        if (!baseBranch && list.length > 0) {
          // Default to main/master if available
          const defaultBranch = list.find(b => b === 'main') ?? list.find(b => b === 'master') ?? list[0]
          setBaseBranch(defaultBranch)
        }
      } catch { /* ignore */ }
    })()
  }, [projectPath])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !baseBranch) return
    setCreating(true)
    setError(null)
    try {
      const result = await window.api.git.createPr({
        repoPath: targetPath,
        title: title.trim(),
        body: body.trim(),
        baseBranch,
        draft
      })
      onCreated(result.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Create Pull Request</h3>
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="text-xs">
            Cancel
          </Button>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Title</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="PR title..."
            className="h-8 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Description</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Describe your changes..."
            rows={4}
            className="w-full rounded-md border bg-transparent px-3 py-2 text-sm resize-y min-h-[80px] focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Base Branch</label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowBranches(!showBranches)}
              className="flex items-center gap-2 w-full h-8 px-3 text-sm rounded-md border bg-transparent text-left hover:bg-muted/50"
            >
              <span className="flex-1 truncate">{baseBranch || 'Select branch...'}</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
            </button>
            {showBranches && (
              <div className="absolute z-10 mt-1 w-full max-h-40 overflow-y-auto rounded-md border bg-popover shadow-md">
                {branches.map((branch) => (
                  <button
                    key={branch}
                    type="button"
                    onClick={() => { setBaseBranch(branch); setShowBranches(false) }}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-accent text-left"
                  >
                    {branch === baseBranch ? <Check className="h-3 w-3 text-primary" /> : <span className="w-3" />}
                    {branch}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs">
          <Checkbox checked={draft} onCheckedChange={(v) => setDraft(!!v)} />
          Create as draft
        </label>

        {error && (
          <div className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</div>
        )}

        <Button type="submit" size="sm" disabled={creating || !title.trim() || !baseBranch} className="gap-2">
          {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitPullRequest className="h-3.5 w-3.5" />}
          {creating ? 'Creating...' : 'Create Pull Request'}
        </Button>
      </form>
    </div>
  )
}

// --- Link existing PR ---

function LinkPrView({ projectPath, onLink, onCancel, error }: {
  projectPath: string
  onLink: (url: string) => void
  onCancel: () => void
  error: string | null
}) {
  const [prs, setPrs] = useState<GhPullRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const list = await window.api.git.listOpenPrs(projectPath)
        setPrs(list)
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    })()
  }, [projectPath])

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 px-4 py-3 border-b flex items-center justify-between">
        <h3 className="text-sm font-medium">Link Pull Request</h3>
        <Button variant="ghost" size="sm" onClick={onCancel} className="text-xs">Cancel</Button>
      </div>

      {(error || fetchError) && (
        <div className="px-4 py-2 text-xs text-destructive">{error || fetchError}</div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : prs.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">No open pull requests</div>
        ) : (
          <div className="py-1">
            {prs.map((pr) => (
              <button
                key={pr.number}
                onClick={() => onLink(pr.url)}
                className="flex items-start gap-3 w-full px-4 py-2.5 text-left hover:bg-accent/50 transition-colors"
              >
                <PrStateIcon state={pr.state} isDraft={pr.isDraft} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{pr.title}</div>
                  <div className="text-[10px] text-muted-foreground">
                    #{pr.number} · {pr.headRefName} → {pr.baseRefName} · {pr.author}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// --- Shared helpers ---

function PrStateIcon({ state, isDraft }: { state: GhPullRequest['state']; isDraft: boolean }) {
  if (isDraft) return <GitPullRequest className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
  if (state === 'MERGED') return <GitMerge className="h-4 w-4 text-purple-500 shrink-0 mt-0.5" />
  if (state === 'CLOSED') return <CircleX className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
  return <CircleDot className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
}

function PrStateBadge({ state, isDraft }: { state: GhPullRequest['state']; isDraft: boolean }) {
  if (isDraft) {
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">Draft</span>
  }
  const styles: Record<string, string> = {
    OPEN: 'bg-green-500/10 text-green-500',
    MERGED: 'bg-purple-500/10 text-purple-500',
    CLOSED: 'bg-red-500/10 text-red-500'
  }
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium', styles[state] ?? '')}>
      {state.charAt(0) + state.slice(1).toLowerCase()}
    </span>
  )
}

function EmptyMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full flex items-center justify-center">
      <p className="text-xs text-muted-foreground">{children}</p>
    </div>
  )
}
