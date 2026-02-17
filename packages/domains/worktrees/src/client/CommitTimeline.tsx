import { ArrowRight, Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger, cn } from '@slayzone/ui'
import type { RebaseProgress } from '../shared/types'
import type { MergeContext } from '@slayzone/task/shared'

interface CommitTimelineProps {
  context: MergeContext
  rebaseProgress?: RebaseProgress | null
}

export function CommitTimeline({ context, rebaseProgress }: CommitTimelineProps) {
  if (context.type === 'merge') {
    return <MergeTimeline context={context} />
  }
  return <RebaseTimeline context={context} progress={rebaseProgress ?? null} />
}

function MergeTimeline({ context }: { context: MergeContext }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/20">
      <span className="text-xs font-mono font-medium text-blue-500">{context.sourceBranch}</span>
      <ArrowRight className="h-3 w-3 text-muted-foreground" />
      <span className="text-xs font-mono font-medium text-green-500">{context.targetBranch}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs">
          <p className="font-medium mb-1">Merging {context.sourceBranch} into {context.targetBranch}</p>
          <p><span className="text-blue-400">Ours</span> = {context.targetBranch} (your current branch)</p>
          <p><span className="text-yellow-400">Theirs</span> = {context.sourceBranch} (incoming changes)</p>
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

function RebaseTimeline({ context, progress }: { context: MergeContext; progress: RebaseProgress | null }) {
  return (
    <div className="px-4 py-2 border-b bg-muted/20">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-muted-foreground">Rebasing</span>
        <span className="text-xs font-mono font-medium text-blue-500">{context.sourceBranch}</span>
        <span className="text-xs text-muted-foreground">onto</span>
        <span className="text-xs font-mono font-medium text-green-500">{context.targetBranch}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="h-3 w-3 text-muted-foreground cursor-help" />
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs text-xs">
            <p className="font-medium mb-1">Rebasing {context.sourceBranch} onto {context.targetBranch}</p>
            <p><span className="text-blue-400">Ours</span> = {context.targetBranch} (branch you're rebasing onto)</p>
            <p><span className="text-yellow-400">Theirs</span> = {context.sourceBranch} (your commits being replayed)</p>
            <p className="mt-1 text-muted-foreground">Note: during rebase, git swaps ours/theirs from what you'd expect. The labels here reflect the actual content.</p>
          </TooltipContent>
        </Tooltip>
      </div>

      {progress && progress.commits.length > 0 && (
        <div className="flex items-center gap-1 overflow-x-auto">
          {progress.commits.map((commit, i) => (
            <Tooltip key={commit.hash}>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1">
                  {i > 0 && <div className="w-3 h-px bg-border" />}
                  <div
                    className={cn(
                      'w-3 h-3 rounded-full border-2 shrink-0',
                      commit.status === 'applied' && 'bg-green-500 border-green-500',
                      commit.status === 'current' && 'bg-yellow-500 border-yellow-500 ring-2 ring-yellow-500/30',
                      commit.status === 'pending' && 'bg-transparent border-muted-foreground'
                    )}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                <p className="font-mono">{commit.shortHash}</p>
                <p className="max-w-xs truncate">{commit.message}</p>
                <p className="text-muted-foreground capitalize">{commit.status}</p>
              </TooltipContent>
            </Tooltip>
          ))}
          <span className="text-[10px] text-muted-foreground ml-2 shrink-0">
            {progress.current}/{progress.total}
          </span>
        </div>
      )}
    </div>
  )
}
