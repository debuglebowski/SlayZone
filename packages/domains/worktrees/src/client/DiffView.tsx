import { memo, useCallback, useMemo, useRef } from 'react'
import { FileImage, FileMinus } from 'lucide-react'
import { cn } from '@slayzone/ui'
import type { FileDiff, DiffLine as DiffLineType, InlineHighlight } from './parse-diff'
import { tokenizeContent, type HlSpan } from './highlight'

type ContextLines = '0' | '3' | '5' | 'all'

interface DiffViewProps {
  diff: FileDiff
  sideBySide?: boolean
  wrap?: boolean
  contextLines?: ContextLines
}

interface FlatLine {
  line: DiffLineType
  spans?: HlSpan[]
}

interface DisplayChunk {
  kind: 'visible'
  lines: FlatLine[]
  /** Absolute index of first line in this chunk within the flat sequence */
  firstIdx: number
}
interface GapChunk {
  kind: 'gap'
  count: number
}

function flattenAndTokenize(diff: FileDiff): FlatLine[] {
  const oldLines: string[] = []
  const newLines: string[] = []
  const refs: { side: 'old' | 'new'; idx: number }[][] = []

  for (const hunk of diff.hunks) {
    for (const l of hunk.lines) {
      const r: { side: 'old' | 'new'; idx: number }[] = []
      if (l.type === 'context') {
        r.push({ side: 'old', idx: oldLines.length })
        r.push({ side: 'new', idx: newLines.length })
        oldLines.push(l.content)
        newLines.push(l.content)
      } else if (l.type === 'delete') {
        r.push({ side: 'old', idx: oldLines.length })
        oldLines.push(l.content)
      } else {
        r.push({ side: 'new', idx: newLines.length })
        newLines.push(l.content)
      }
      refs.push(r)
    }
  }

  const oldSpans = tokenizeContent(oldLines.join('\n'), diff.path)
  const newSpans = tokenizeContent(newLines.join('\n'), diff.path)

  const flat: FlatLine[] = []
  let idx = 0
  for (const hunk of diff.hunks) {
    for (const line of hunk.lines) {
      const ref = refs[idx].find((r) => r.side === 'new') ?? refs[idx][0]
      const arr = ref?.side === 'old' ? oldSpans : newSpans
      flat.push({ line, spans: ref ? arr[ref.idx] : undefined })
      idx++
    }
  }
  return flat
}

function computeChunks(flat: FlatLine[], contextLines: ContextLines): (DisplayChunk | GapChunk)[] {
  const ctx = contextLines === 'all' ? Number.POSITIVE_INFINITY : parseInt(contextLines, 10)
  const visible = new Uint8Array(flat.length)

  if (ctx === Number.POSITIVE_INFINITY) {
    visible.fill(1)
  } else {
    for (let i = 0; i < flat.length; i++) {
      if (flat[i].line.type !== 'context') {
        const lo = Math.max(0, i - ctx)
        const hi = Math.min(flat.length - 1, i + ctx)
        for (let k = lo; k <= hi; k++) visible[k] = 1
      }
    }
  }

  const out: (DisplayChunk | GapChunk)[] = []
  let i = 0
  while (i < flat.length) {
    if (!visible[i]) {
      const start = i
      while (i < flat.length && !visible[i]) i++
      out.push({ kind: 'gap', count: i - start })
    } else {
      const start = i
      const lines: FlatLine[] = []
      while (i < flat.length && visible[i]) { lines.push(flat[i]); i++ }
      out.push({ kind: 'visible', lines, firstIdx: start })
    }
  }
  return out
}

function renderContent(content: string, type: DiffLineType['type'], wrap: boolean, spans?: HlSpan[], highlights?: InlineHighlight[]) {
  const ws = wrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'
  const hasSpans = !!spans && spans.length > 0
  const hasHl = !!highlights && highlights.length > 0

  if (!hasSpans && !hasHl) return <span className={ws}>{content}</span>

  const highlightClass = type === 'add' ? 'bg-green-500/40 rounded-sm' : 'bg-red-500/40 rounded-sm'

  // Build sorted unique boundaries
  const b = new Set<number>([0, content.length])
  if (hasSpans) for (const s of spans!) { b.add(s.from); b.add(s.to) }
  if (hasHl) for (const h of highlights!) { b.add(h.start); b.add(h.end) }
  const points = [...b].sort((a, z) => a - z)

  const parts: React.JSX.Element[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i]
    const to = points[i + 1]
    if (to <= from) continue
    const tokenSpan = hasSpans ? spans!.find((s) => s.from <= from && s.to >= to) : undefined
    const highlighted = hasHl ? highlights!.some((h) => h.start <= from && h.end >= to) : false
    parts.push(
      <span
        key={i}
        className={cn(ws, tokenSpan?.classes, highlighted && highlightClass)}
      >
        {content.slice(from, to)}
      </span>
    )
  }
  return <>{parts}</>
}

const UnifiedLine = memo(function UnifiedLine({ item, wrap }: { item: FlatLine; wrap: boolean }) {
  const { line, spans } = item
  const prefix = line.type === 'add' ? '+' : line.type === 'delete' ? '-' : ' '
  return (
    <div
      className={cn(
        'flex w-full',
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
          wrap ? 'min-w-0 flex-1' : 'shrink-0',
          line.type === 'add' && 'text-green-700 dark:text-green-400',
          line.type === 'delete' && 'text-red-700 dark:text-red-400'
        )}
      >
        {renderContent(line.content, line.type, wrap, spans, line.highlights)}
      </span>
    </div>
  )
})

interface SideRow {
  left: FlatLine | null
  right: FlatLine | null
}

function buildSbsRows(lines: FlatLine[]): SideRow[] {
  const rows: SideRow[] = []
  let i = 0
  while (i < lines.length) {
    if (lines[i].line.type === 'context') {
      rows.push({ left: lines[i], right: lines[i] })
      i++
      continue
    }
    const delStart = i
    while (i < lines.length && lines[i].line.type === 'delete') i++
    const delEnd = i
    const addStart = i
    while (i < lines.length && lines[i].line.type === 'add') i++
    const addEnd = i
    const delN = delEnd - delStart
    const addN = addEnd - addStart
    const max = Math.max(delN, addN)
    for (let j = 0; j < max; j++) {
      rows.push({
        left: j < delN ? lines[delStart + j] : null,
        right: j < addN ? lines[addStart + j] : null,
      })
    }
  }
  return rows
}

const SbsHalf = memo(function SbsHalf({ item, side, wrap }: { item: FlatLine | null; side: 'left' | 'right'; wrap: boolean }) {
  if (!item) {
    return (
      <div className="flex w-full bg-muted/20">
        <span className="w-10 shrink-0 border-r border-border/30" />
        <span className="w-5 shrink-0" />
        <span className={cn(wrap ? 'min-w-0 flex-1' : 'shrink-0')}>&nbsp;</span>
      </div>
    )
  }
  const { line, spans } = item
  const isAdd = line.type === 'add'
  const isDel = line.type === 'delete'
  const prefix = isAdd ? '+' : isDel ? '-' : ' '
  const lineNo = side === 'left' ? line.oldLineNo : line.newLineNo
  return (
    <div
      className={cn(
        'flex w-full',
        isAdd && 'bg-green-500/10',
        isDel && 'bg-red-500/10'
      )}
    >
      <span className="w-10 shrink-0 text-right pr-1.5 text-muted-foreground/50 select-none border-r border-border/30 tabular-nums">
        {lineNo ?? ''}
      </span>
      <span className="w-5 shrink-0 text-center select-none text-muted-foreground/60">{prefix}</span>
      <span
        className={cn(
          wrap ? 'min-w-0 flex-1' : 'shrink-0',
          isAdd && 'text-green-700 dark:text-green-400',
          isDel && 'text-red-700 dark:text-red-400'
        )}
      >
        {renderContent(line.content, line.type, wrap, spans, line.highlights)}
      </span>
    </div>
  )
})

function GapDivider({ count }: { count: number }) {
  return (
    <div className="px-2 py-1.5 bg-card w-full">
      <div className="rounded-md border border-dashed border-border text-muted-foreground px-3 py-1 text-[11px] font-medium tracking-wide">
        {count} unmodified line{count === 1 ? '' : 's'}
      </div>
    </div>
  )
}

export const DiffView = memo(function DiffView({ diff, sideBySide = false, wrap = false, contextLines = '3' }: DiffViewProps) {
  const flat = useMemo(() => flattenAndTokenize(diff), [diff])
  const chunks = useMemo(() => computeChunks(flat, contextLines), [flat, contextLines])

  const sbsScrollRefs = useRef<(HTMLDivElement | null)[]>([])
  const syncingRef = useRef(false)
  const onSbsScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (syncingRef.current) return
    syncingRef.current = true
    const src = e.currentTarget
    const sl = src.scrollLeft
    for (const el of sbsScrollRefs.current) {
      if (el && el !== src && el.scrollLeft !== sl) el.scrollLeft = sl
    }
    syncingRef.current = false
  }, [])
  const setSbsRef = useCallback((i: number) => (el: HTMLDivElement | null) => {
    sbsScrollRefs.current[i] = el
  }, [])

  if (diff.isBinary) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <FileImage className="size-10 opacity-30" />
          <div className="text-center">
            <p className="text-base font-medium text-foreground/60">Binary file</p>
            <p className="text-sm mt-0.5 opacity-60">Diff not available for binary files</p>
          </div>
        </div>
      </div>
    )
  }

  if (flat.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <FileMinus className="size-10 opacity-30" />
          <div className="text-center">
            <p className="text-base font-medium text-foreground/60">No changes</p>
            <p className="text-sm mt-0.5 opacity-60">Metadata or mode change only</p>
          </div>
        </div>
      </div>
    )
  }

  if (sideBySide) {
    let scrollIdx = 0
    return (
      <div className="font-mono text-xs leading-5">
        {chunks.map((c, ci) => {
          if (c.kind === 'gap') {
            return <GapDivider key={`g${ci}`} count={c.count} />
          }
          const rows = buildSbsRows(c.lines)
          const leftIdx = scrollIdx++
          const rightIdx = scrollIdx++
          return (
            <div key={`v${ci}`} className="flex">
              <div
                ref={setSbsRef(leftIdx)}
                onScroll={onSbsScroll}
                className={cn('flex-1 min-w-0', !wrap && 'overflow-x-auto scrollbar-hide')}
              >
                <div className={cn('flex flex-col', !wrap && 'min-w-full w-max')}>
                  {rows.map((row, ri) => (
                    <SbsHalf key={ri} item={row.left} side="left" wrap={wrap} />
                  ))}
                </div>
              </div>
              <div className="w-px bg-border/40 shrink-0" />
              <div
                ref={setSbsRef(rightIdx)}
                onScroll={onSbsScroll}
                className={cn('flex-1 min-w-0', !wrap && 'overflow-x-auto scrollbar-hide')}
              >
                <div className={cn('flex flex-col', !wrap && 'min-w-full w-max')}>
                  {rows.map((row, ri) => (
                    <SbsHalf key={ri} item={row.right} side="right" wrap={wrap} />
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className={cn('font-mono text-xs leading-5', !wrap && 'overflow-x-auto scrollbar-hide')}>
      <div className={cn('flex flex-col', !wrap && 'min-w-full w-max')}>
        {chunks.map((c, ci) => c.kind === 'gap'
          ? <GapDivider key={`g${ci}`} count={c.count} />
          : c.lines.map((item, li) => <UnifiedLine key={`v${ci}-${li}`} item={item} wrap={wrap} />)
        )}
      </div>
    </div>
  )
})
