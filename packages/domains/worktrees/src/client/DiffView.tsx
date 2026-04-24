import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { FileImage, FileMinus } from 'lucide-react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { cn } from '@slayzone/ui'
import type { FileDiff, DiffLine as DiffLineType, InlineHighlight } from './parse-diff'
import { ensureInlineHighlights } from './parse-diff'
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

interface LineRef {
  side: 'old' | 'new'
  idx: number
}

interface FlattenResult {
  flat: FlatLine[]
  oldContent: string
  newContent: string
  refs: LineRef[]
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

// Threshold under which virtualization overhead isn't worth it. Small diffs
// render every row directly so there's no measurement/positioning overhead.
const VIRTUALIZE_THRESHOLD = 100

function flattenDiff(diff: FileDiff): FlattenResult {
  const oldLines: string[] = []
  const newLines: string[] = []
  const refs: LineRef[] = []
  const flat: FlatLine[] = []

  for (const hunk of diff.hunks) {
    for (const l of hunk.lines) {
      let ref: LineRef
      if (l.type === 'context') {
        ref = { side: 'new', idx: newLines.length }
        oldLines.push(l.content)
        newLines.push(l.content)
      } else if (l.type === 'delete') {
        ref = { side: 'old', idx: oldLines.length }
        oldLines.push(l.content)
      } else {
        ref = { side: 'new', idx: newLines.length }
        newLines.push(l.content)
      }
      refs.push(ref)
      flat.push({ line: l })
    }
  }

  return {
    flat,
    oldContent: oldLines.join('\n'),
    newContent: newLines.join('\n'),
    refs,
  }
}

function applySpans(flat: FlatLine[], refs: LineRef[], oldSpans: HlSpan[][], newSpans: HlSpan[][]): FlatLine[] {
  const out: FlatLine[] = new Array(flat.length)
  for (let i = 0; i < flat.length; i++) {
    const ref = refs[i]
    const arr = ref.side === 'old' ? oldSpans : newSpans
    out[i] = { line: flat[i].line, spans: arr[ref.idx] }
  }
  return out
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
  if (out.length && out[0].kind === 'gap') out.shift()
  if (out.length && out[out.length - 1].kind === 'gap') out.pop()
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

  // First pass: compute [from, to, className] segments. Second pass coalesces
  // adjacent segments with identical classes into one span, which slashes
  // React element count on syntax-heavy lines (e.g. a line with four adjacent
  // token boundaries that all resolve to the same class produces ONE span
  // after this, down from four). Pure optimisation — output text is identical.
  //
  // Span lookup uses a 2-pointer walk instead of `spans.find` per segment.
  // Spans arrive in position order from the tokenize worker (highlightTree
  // traverses in document order, non-overlapping at leaves) and segments are
  // walked in ascending `from`, so advancing a pointer past any span that
  // ends at or before the current segment's start is safe. Amortized O(1)
  // per segment instead of O(M) — saves real time on long minified lines
  // with hundreds of tokens. Preserves `find`'s first-match semantic: within
  // a set of candidates whose `from ≤ segFrom`, we pick the earliest array
  // index whose `to ≥ segTo`, matching the prior behavior byte-for-byte.
  type Seg = { from: number; to: number; cls: string }
  const rawSegs: Seg[] = []
  const spanArr = hasSpans ? spans! : undefined
  let sp = 0
  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i]
    const to = points[i + 1]
    if (to <= from) continue
    let tokenSpan: HlSpan | undefined
    if (spanArr) {
      // Retire spans that end at or before this segment starts — they cannot
      // match this or any later segment (segments only move forward).
      while (sp < spanArr.length && spanArr[sp].to <= from) sp++
      // Scan forward from sp for the first span covering [from, to]. Spans
      // starting after `from` cannot cover it, so this loop terminates quickly.
      for (let k = sp; k < spanArr.length; k++) {
        const s = spanArr[k]
        if (s.from > from) break
        if (s.to >= to) { tokenSpan = s; break }
      }
    }
    const highlighted = hasHl ? highlights!.some((h) => h.start <= from && h.end >= to) : false
    const cls = cn(ws, tokenSpan?.classes, highlighted && highlightClass)
    rawSegs.push({ from, to, cls })
  }

  const parts: React.JSX.Element[] = []
  let i = 0
  while (i < rawSegs.length) {
    const start = i
    const cls = rawSegs[i].cls
    let end = i + 1
    while (end < rawSegs.length && rawSegs[end].cls === cls) end++
    const from = rawSegs[start].from
    const to = rawSegs[end - 1].to
    parts.push(
      <span key={start} className={cls}>
        {content.slice(from, to)}
      </span>
    )
    i = end
  }
  return <>{parts}</>
}

const UnifiedLine = memo(function UnifiedLine({ item, wrap }: { item: FlatLine; wrap: boolean }) {
  const { line, spans } = item
  const prefix = line.type === 'add' ? '+' : line.type === 'delete' ? '-' : ' '
  return (
    <div
      className={cn(
        'flex w-full border-l-[3px] border-l-transparent',
        line.type === 'add' && 'bg-green-500/10 border-l-green-500',
        line.type === 'delete' && 'bg-red-500/10 border-l-red-500'
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

// ── buildSbsRows cache (H) ────────────────────────────────────────────
// Keyed on the `lines` array reference — chunk.lines is stable across renders
// as long as the upstream `chunks` memo hasn't rebuilt, so a WeakMap lets
// repeat calls (e.g. when unrelated state invalidates the enclosing memo
// chain) reuse the row list without re-pairing adds/deletes.
const sbsRowsCache = new WeakMap<FlatLine[], SideRow[]>()

function buildSbsRows(lines: FlatLine[]): SideRow[] {
  const cached = sbsRowsCache.get(lines)
  if (cached) return cached
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
  sbsRowsCache.set(lines, rows)
  return rows
}

const SbsHalf = memo(function SbsHalf({ item, side, wrap }: { item: FlatLine | null; side: 'left' | 'right'; wrap: boolean }) {
  if (!item) {
    return (
      <div className="flex w-full bg-muted/20 border-l-[3px] border-l-transparent">
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
        'flex w-full border-l-[3px] border-l-transparent',
        isAdd && 'bg-green-500/10 border-l-green-500',
        isDel && 'bg-red-500/10 border-l-red-500'
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
      <div className="rounded-md bg-muted text-muted-foreground px-3 py-1 text-[11px] font-medium tracking-wide">
        {count} unmodified line{count === 1 ? '' : 's'}
      </div>
    </div>
  )
}

// ---- Flat row sequence (chunks + gaps → positionable list) ----

type UnifiedRow =
  | { kind: 'gap'; count: number; key: string }
  | { kind: 'line'; item: FlatLine; key: string }

type SbsRow =
  | { kind: 'gap'; count: number; key: string }
  | { kind: 'row'; row: SideRow; key: string }

function buildUnifiedRows(chunks: (DisplayChunk | GapChunk)[]): UnifiedRow[] {
  const rows: UnifiedRow[] = []
  chunks.forEach((c, ci) => {
    if (c.kind === 'gap') {
      rows.push({ kind: 'gap', count: c.count, key: `g${ci}` })
    } else {
      c.lines.forEach((item, li) => rows.push({ kind: 'line', item, key: `v${ci}-${li}` }))
    }
  })
  return rows
}

function buildSbsRowList(chunks: (DisplayChunk | GapChunk)[]): SbsRow[] {
  const rows: SbsRow[] = []
  chunks.forEach((c, ci) => {
    if (c.kind === 'gap') {
      rows.push({ kind: 'gap', count: c.count, key: `g${ci}` })
    } else {
      buildSbsRows(c.lines).forEach((row, ri) => rows.push({ kind: 'row', row, key: `v${ci}-${ri}` }))
    }
  })
  return rows
}

// ---- Scroll parent discovery ----
// Walk up from an element to the nearest scrollable ancestor so the virtualizer
// can hook into whatever container the consumer provided (split-view owns a
// scroll div). If an `absolute`-positioned ancestor sits between us and the
// scroll parent, we are nested inside an outer virtualizer (continuous-flow
// mode in GitDiffPanel) — virtualizing here would conflict with the outer
// virtualizer's position tracking. Return null in that case so the caller can
// fall back to plain rendering and let the outer virtualizer do its job.
function findScrollParent(el: HTMLElement | null): HTMLElement | null {
  let cur = el?.parentElement ?? null
  let sawAbsolute = false
  while (cur) {
    const style = window.getComputedStyle(cur)
    if (style.position === 'absolute') sawAbsolute = true
    const overflowY = style.overflowY
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
      return sawAbsolute ? null : cur
    }
    cur = cur.parentElement
  }
  return null
}

// ---- Horizontal scroll sync (side-by-side, !wrap) ----
// Virtualization means N halves for visible rows instead of 2 per chunk, so we
// register every half with a shared ref set and broadcast scrollLeft on change.
interface SbsSyncApi {
  register: (el: HTMLDivElement | null) => void
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void
  scrollLeftRef: React.MutableRefObject<number>
}

function useSbsSync(): SbsSyncApi {
  const elsRef = useRef<Set<HTMLDivElement>>(new Set())
  const scrollLeftRef = useRef(0)
  const syncingRef = useRef(false)

  const register = useCallback((el: HTMLDivElement | null) => {
    if (!el) return
    if (!elsRef.current.has(el)) {
      elsRef.current.add(el)
      // Bring new half in sync with the current scroll position so virtualized
      // rows that mount mid-scroll don't jump back to zero.
      if (el.scrollLeft !== scrollLeftRef.current) {
        el.scrollLeft = scrollLeftRef.current
      }
    }
  }, [])

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (syncingRef.current) return
    syncingRef.current = true
    const src = e.currentTarget
    const sl = src.scrollLeft
    scrollLeftRef.current = sl
    for (const el of elsRef.current) {
      if (el !== src && el.scrollLeft !== sl) el.scrollLeft = sl
    }
    syncingRef.current = false
  }, [])

  // Clean up disconnected elements on every render (cheap; set size = visible rows)
  useEffect(() => {
    const alive = new Set<HTMLDivElement>()
    for (const el of elsRef.current) {
      if (el.isConnected) alive.add(el)
    }
    elsRef.current = alive
  })

  return { register, onScroll, scrollLeftRef }
}

// ---- Virtualized row list (shared for unified + sbs) ----

interface VirtualRowListProps<Row> {
  rows: Row[]
  renderRow: (row: Row, index: number) => React.ReactNode
  estimateSize: number
  rowKey: (row: Row) => string
  className?: string
}

type ScrollState = { parent: HTMLElement; nested: false } | { parent: null; nested: true } | null

function VirtualRowList<Row>({ rows, renderRow, estimateSize, rowKey, className }: VirtualRowListProps<Row>) {
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const [scrollState, setScrollState] = useState<ScrollState>(null)

  useLayoutEffect(() => {
    const parent = findScrollParent(sentinelRef.current)
    if (parent) setScrollState({ parent, nested: false })
    else setScrollState({ parent: null, nested: true })
  }, [])

  const parent = scrollState?.nested === false ? scrollState.parent : null
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parent,
    estimateSize: () => estimateSize,
    overscan: 8,
    getItemKey: (i) => rowKey(rows[i]),
  })

  // Measurement frame: until scroll state known, reserve space with estimate.
  if (scrollState === null) {
    return (
      <div ref={sentinelRef} className={className} style={{ height: rows.length * estimateSize }} />
    )
  }

  // Nested inside an outer virtualizer (e.g. GitDiffPanel continuous-flow mode)
  // — fall back to plain rendering. Outer virtualizer keeps offscreen files
  // unmounted, which handles the large-diff case at the file granularity.
  if (scrollState.nested) {
    return (
      <div ref={sentinelRef} className={className}>
        {rows.map((r, i) => (
          <div key={rowKey(r)}>{renderRow(r, i)}</div>
        ))}
      </div>
    )
  }

  const items = virtualizer.getVirtualItems()
  return (
    <div
      ref={sentinelRef}
      className={className}
      style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}
    >
      {items.map((v) => (
        <div
          key={v.key}
          data-index={v.index}
          ref={virtualizer.measureElement}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, transform: `translateY(${v.start}px)` }}
        >
          {renderRow(rows[v.index], v.index)}
        </div>
      ))}
    </div>
  )
}

// ---- Side-by-side row with per-half horizontal scroll sync ----

function SbsRowView({ row, wrap, sync }: { row: SideRow; wrap: boolean; sync: SbsSyncApi }) {
  return (
    <div className="flex">
      <div
        ref={sync.register}
        onScroll={sync.onScroll}
        className={cn('flex-1 min-w-0 basis-1/2', !wrap && 'overflow-x-auto scrollbar-hide')}
      >
        <div className={cn('flex flex-col', !wrap && 'min-w-full w-max')}>
          <SbsHalf item={row.left} side="left" wrap={wrap} />
        </div>
      </div>
      <div
        ref={sync.register}
        onScroll={sync.onScroll}
        className={cn('flex-1 min-w-0 basis-1/2', !wrap && 'overflow-x-auto scrollbar-hide')}
      >
        <div className={cn('flex flex-col', !wrap && 'min-w-full w-max')}>
          <SbsHalf item={row.right} side="right" wrap={wrap} />
        </div>
      </div>
    </div>
  )
}

export const DiffView = memo(function DiffView({ diff, sideBySide = false, wrap = false, contextLines = '3' }: DiffViewProps) {
  // Lazy inline-highlight pass: parseUnifiedDiff no longer runs this per-file.
  // Calling here means offscreen files in a large virtualized patch never pay
  // the cost. `ensureInlineHighlights` is idempotent via a flag on FileDiff.
  const flattened = useMemo(() => {
    ensureInlineHighlights(diff)
    return flattenDiff(diff)
  }, [diff])
  const [highlighted, setHighlighted] = useState<FlatLine[] | null>(null)

  useEffect(() => {
    let cancelled = false
    setHighlighted(null)
    const { flat, refs, oldContent, newContent } = flattened
    if (flat.length === 0) return
    Promise.all([
      tokenizeContent(oldContent, diff.path),
      tokenizeContent(newContent, diff.path),
    ]).then(([oldSpans, newSpans]) => {
      if (cancelled) return
      setHighlighted(applySpans(flat, refs, oldSpans, newSpans))
    }).catch(() => {
      // highlight.ts already swallows/logs; fall through to plain rendering
    })
    return () => { cancelled = true }
  }, [flattened, diff.path])

  const flat = highlighted ?? flattened.flat
  const chunks = useMemo(() => computeChunks(flat, contextLines), [flat, contextLines])

  const unifiedRows = useMemo(() => (sideBySide ? [] : buildUnifiedRows(chunks)), [chunks, sideBySide])
  const sbsRows = useMemo(() => (sideBySide ? buildSbsRowList(chunks) : []), [chunks, sideBySide])

  const sbsSync = useSbsSync()

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
    const renderSbsRow = (row: SbsRow) => {
      if (row.kind === 'gap') return <GapDivider count={row.count} />
      return <SbsRowView row={row.row} wrap={wrap} sync={sbsSync} />
    }
    // Small diffs: skip virtualizer overhead entirely.
    if (sbsRows.length < VIRTUALIZE_THRESHOLD) {
      return (
        <div className="relative font-mono text-xs leading-5">
          <div className="pointer-events-none absolute top-0 bottom-0 left-1/2 w-px bg-border/40 z-10" />
          {sbsRows.map((r) => (
            <div key={r.key}>{renderSbsRow(r)}</div>
          ))}
        </div>
      )
    }
    return (
      <div className="relative font-mono text-xs leading-5">
        <div className="pointer-events-none absolute top-0 bottom-0 left-1/2 w-px bg-border/40 z-10" />
        <VirtualRowList<SbsRow>
          rows={sbsRows}
          renderRow={renderSbsRow}
          estimateSize={20}
          rowKey={(r) => r.key}
        />
      </div>
    )
  }

  const renderUnifiedRow = (row: UnifiedRow) => {
    if (row.kind === 'gap') return <GapDivider count={row.count} />
    return <UnifiedLine item={row.item} wrap={wrap} />
  }

  // Small diffs: skip virtualizer overhead entirely.
  if (unifiedRows.length < VIRTUALIZE_THRESHOLD) {
    return (
      <div className={cn('font-mono text-xs leading-5', !wrap && 'overflow-x-auto scrollbar-hide')}>
        <div className={cn('flex flex-col', !wrap && 'min-w-full w-max')}>
          {unifiedRows.map((r) => (
            <div key={r.key}>{renderUnifiedRow(r)}</div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('font-mono text-xs leading-5', !wrap && 'overflow-x-auto scrollbar-hide')}>
      <div className={cn(!wrap && 'min-w-full w-max')}>
        <VirtualRowList<UnifiedRow>
          rows={unifiedRows}
          renderRow={renderUnifiedRow}
          estimateSize={20}
          rowKey={(r) => r.key}
        />
      </div>
    </div>
  )
})
