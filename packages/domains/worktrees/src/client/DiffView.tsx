import { cn } from '@slayzone/ui'
import type { FileDiff, DiffLine as DiffLineType, InlineHighlight } from './parse-diff'

interface DiffViewProps {
  diff: FileDiff
}

function renderContent(content: string, type: DiffLineType['type'], highlights?: InlineHighlight[]) {
  if (!highlights || highlights.length === 0) {
    return <span className="whitespace-pre">{content}</span>
  }

  const highlightClass = type === 'add'
    ? 'bg-green-500/40 rounded-sm'
    : 'bg-red-500/40 rounded-sm'

  const parts: React.JSX.Element[] = []
  let lastEnd = 0
  for (let i = 0; i < highlights.length; i++) {
    const h = highlights[i]
    if (h.start > lastEnd) {
      parts.push(<span key={`t${i}`} className="whitespace-pre">{content.slice(lastEnd, h.start)}</span>)
    }
    parts.push(
      <span key={`h${i}`} className={cn('whitespace-pre', highlightClass)}>
        {content.slice(h.start, h.end)}
      </span>
    )
    lastEnd = h.end
  }
  if (lastEnd < content.length) {
    parts.push(<span key="tail" className="whitespace-pre">{content.slice(lastEnd)}</span>)
  }
  return <>{parts}</>
}

function DiffLineCmp({ line }: { line: DiffLineType }) {
  const prefix = line.type === 'add' ? '+' : line.type === 'delete' ? '-' : ' '

  return (
    <div
      className={cn(
        'flex',
        line.type === 'add' && 'bg-green-500/10',
        line.type === 'delete' && 'bg-red-500/10'
      )}
    >
      <span className="w-10 shrink-0 text-right pr-1.5 text-muted-foreground/50 select-none border-r border-border/30 tabular-nums">
        {line.oldLineNo ?? ''}
      </span>
      <span className="w-10 shrink-0 text-right pr-1.5 text-muted-foreground/50 select-none border-r border-border/30 tabular-nums">
        {line.newLineNo ?? ''}
      </span>
      <span className="w-5 shrink-0 text-center select-none text-muted-foreground/60">{prefix}</span>
      <span
        className={cn(
          line.type === 'add' && 'text-green-700 dark:text-green-400',
          line.type === 'delete' && 'text-red-700 dark:text-red-400'
        )}
      >
        {renderContent(line.content, line.type, line.highlights)}
      </span>
    </div>
  )
}

export function DiffView({ diff }: DiffViewProps) {
  if (diff.isBinary) {
    return (
      <div className="px-3 py-6 text-xs text-muted-foreground text-center">
        Binary file changed
      </div>
    )
  }

  if (diff.hunks.length === 0) {
    return (
      <div className="px-3 py-6 text-xs text-muted-foreground text-center">
        No diff content
      </div>
    )
  }

  return (
    <div className="font-mono text-xs overflow-x-auto">
      {diff.hunks.map((hunk, hi) => (
        <div key={hi}>
          <div className="bg-accent/50 text-muted-foreground px-3 py-0.5 text-[11px] sticky top-0 z-10 border-y border-border/30">
            {hunk.header}
          </div>
          {hunk.lines.map((line, li) => (
            <DiffLineCmp key={li} line={line} />
          ))}
        </div>
      ))}
    </div>
  )
}
