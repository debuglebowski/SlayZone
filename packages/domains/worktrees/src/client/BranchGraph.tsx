import { cn } from '@slayzone/ui'
import { Copy, Check } from 'lucide-react'
import { useState, useRef, useCallback, useMemo } from 'react'
import type { CommitInfo, DagCommit } from '../shared/types'

// --- Public interfaces (backward-compatible for BranchTab) ---

export interface GraphNode {
  commit: CommitInfo
  column: number
  type: 'commit' | 'branch-tip' | 'fork-point'
  branchName?: string
  branchLabel?: string
}

type BranchGraphProps =
  | { mode: 'tips'; nodes: GraphNode[]; maxColumns: number; className?: string }
  | { mode: 'dag'; commits: DagCommit[]; filterQuery?: string; tipsOnly?: boolean; className?: string }

// --- Constants ---

const ROW_HEIGHT = 32
const COLUMN_WIDTH = 24
const DOT_RADIUS = 4
const MERGE_DOT_OUTER = 6
const MERGE_DOT_INNER = 3
const GUTTER_PAD = 12

const COLUMN_COLORS = [
  'var(--color-primary)',
  '#a78bfa', // violet
  '#f59e0b', // amber
  '#10b981', // emerald
  '#f472b6', // pink
  '#06b6d4', // cyan
  '#ef4444', // red
  '#8b5cf6', // purple
  '#14b8a6', // teal
  '#f97316', // orange
]

function getColor(column: number): string {
  return COLUMN_COLORS[column % COLUMN_COLORS.length]
}

function colX(col: number): number {
  return col * COLUMN_WIDTH + COLUMN_WIDTH / 2 + GUTTER_PAD / 2
}

function rowY(row: number): number {
  return row * ROW_HEIGHT + ROW_HEIGHT / 2
}

// --- Full DAG topology algorithm ---

interface LayoutNode {
  commit: DagCommit
  column: number
  row: number
  isMerge: boolean
  isBranchTip: boolean
}

interface LayoutEdge {
  fromRow: number
  fromCol: number
  toRow: number
  toCol: number
  color: string
  type: 'straight' | 'curve'
  targetHash?: string
}

interface DagLayout {
  nodes: LayoutNode[]
  edges: LayoutEdge[]
  maxColumn: number
}

function computeDagLayout(commits: DagCommit[]): DagLayout {
  if (commits.length === 0) return { nodes: [], edges: [], maxColumn: 0 }

  const hashToRow = new Map<string, number>()
  const hashToCol = new Map<string, number>()
  const nodes: LayoutNode[] = []
  const edges: LayoutEdge[] = []

  const activeColumns: (string | null)[] = []

  function findFreeColumn(): number {
    for (let i = 0; i < activeColumns.length; i++) {
      if (activeColumns[i] === null) return i
    }
    activeColumns.push(null)
    return activeColumns.length - 1
  }

  function findColumnReservedFor(hash: string): number | null {
    for (let i = 0; i < activeColumns.length; i++) {
      if (activeColumns[i] === hash) return i
    }
    return null
  }

  for (let row = 0; row < commits.length; row++) {
    const commit = commits[row]
    hashToRow.set(commit.hash, row)

    let col = findColumnReservedFor(commit.hash)

    if (col !== null) {
      for (let i = 0; i < activeColumns.length; i++) {
        if (i !== col && activeColumns[i] === commit.hash) {
          activeColumns[i] = null
        }
      }
    }

    if (col === null) {
      col = findFreeColumn()
    }

    hashToCol.set(commit.hash, col)

    const isMerge = commit.parents.length >= 2
    const isBranchTip = commit.refs.length > 0

    nodes.push({ commit, column: col, row, isMerge, isBranchTip })

    if (commit.parents.length === 0) {
      activeColumns[col] = null
    } else {
      const firstParent = commit.parents[0]
      const existingCol = findColumnReservedFor(firstParent)
      if (existingCol !== null && existingCol !== col) {
        activeColumns[col] = null
        edges.push({
          fromRow: row, fromCol: col, toRow: -1, toCol: existingCol,
          color: getColor(col), type: 'curve', targetHash: firstParent
        })
      } else if (existingCol === null) {
        activeColumns[col] = firstParent
      }

      for (let p = 1; p < commit.parents.length; p++) {
        const parentHash = commit.parents[p]
        const pExisting = findColumnReservedFor(parentHash)
        if (pExisting === null) {
          const pCol = findFreeColumn()
          activeColumns[pCol] = parentHash
          edges.push({
            fromRow: row, fromCol: col, toRow: -1, toCol: pCol,
            color: getColor(pCol), type: 'curve', targetHash: parentHash
          })
        } else {
          edges.push({
            fromRow: row, fromCol: col, toRow: -1, toCol: pExisting,
            color: getColor(pExisting), type: 'curve', targetHash: parentHash
          })
        }
      }
    }
  }

  // Resolve deferred edges
  for (const edge of edges) {
    if (edge.toRow === -1 && edge.targetHash) {
      const targetRow = hashToRow.get(edge.targetHash)
      if (targetRow !== undefined) {
        edge.toRow = targetRow
        const targetCol = hashToCol.get(edge.targetHash)
        if (targetCol !== undefined) edge.toCol = targetCol
      }
    }
  }

  // Straight edges for same-column parent links
  for (let row = 0; row < commits.length; row++) {
    const commit = commits[row]
    const col = hashToCol.get(commit.hash)!
    const firstParent = commit.parents[0]
    if (!firstParent) continue
    const parentRow = hashToRow.get(firstParent)
    if (parentRow !== undefined && hashToCol.get(firstParent) === col) {
      edges.push({
        fromRow: row, fromCol: col, toRow: parentRow, toCol: col,
        color: getColor(col), type: 'straight'
      })
    }
  }

  const maxColumn = Math.max(0, ...nodes.map(n => n.column))
  return { nodes, edges, maxColumn }
}

// --- Collapsed layout: branch labels + commit count groups ---

type CollapsedNodeKind = 'branch' | 'group'

interface CollapsedNode {
  kind: CollapsedNodeKind
  label: string         // branch name(s) or "N commits"
  column: number
  row: number
  color: string
  id: string            // for React key
  refs?: string[]       // for branch nodes
  commitCount?: number  // for group nodes
}

interface CollapsedLayout {
  nodes: CollapsedNode[]
  edges: LayoutEdge[]
  maxColumn: number
}

function computeCollapsedLayout(commits: DagCommit[], fullLayout: DagLayout): CollapsedLayout {
  if (commits.length === 0) return { nodes: [], edges: [], maxColumn: 0 }

  // Build children map: parent hash → child hashes
  const childrenOf = new Map<string, string[]>()
  for (const c of commits) {
    for (const p of c.parents) {
      const arr = childrenOf.get(p) || []
      arr.push(c.hash)
      childrenOf.set(p, arr)
    }
  }

  // Build hash→column from full layout
  const hashToCol = new Map<string, number>()
  for (const n of fullLayout.nodes) {
    hashToCol.set(n.commit.hash, n.column)
  }

  // A commit is "interesting" if it has refs, is a fork (multiple children in different columns),
  // or is a merge (multiple parents)
  function isForkPoint(hash: string): boolean {
    const children = childrenOf.get(hash) || []
    if (children.length < 2) return false
    // Fork = children in different columns
    const cols = new Set(children.map(ch => hashToCol.get(ch)).filter(c => c !== undefined))
    return cols.size > 1
  }

  // Group commits by column, in order
  const columnNodes = new Map<number, LayoutNode[]>()
  for (const n of fullLayout.nodes) {
    const arr = columnNodes.get(n.column) || []
    arr.push(n)
    columnNodes.set(n.column, arr)
  }

  const collapsedNodes: CollapsedNode[] = []
  const collapsedEdges: LayoutEdge[] = []
  let nextRow = 0

  // Track which fork points we've already emitted (they can appear in multiple column walks)
  const emittedForks = new Set<string>()
  // Map from original hash → collapsed row (for edges)
  const hashToCollapsedRow = new Map<string, number>()

  // Process columns in order (0 first = main trunk)
  const sortedCols = [...columnNodes.keys()].sort((a, b) => a - b)

  for (const col of sortedCols) {
    const nodes = columnNodes.get(col)!
    const color = getColor(col)

    let segmentStart = 0

    while (segmentStart < nodes.length) {
      const node = nodes[segmentStart]
      const hasRefs = node.commit.refs.length > 0
      const isFork = isForkPoint(node.commit.hash)

      if (hasRefs) {
        // Emit branch label node
        const branchRow = nextRow++
        collapsedNodes.push({
          kind: 'branch',
          label: node.commit.refs.join(', '),
          column: col,
          row: branchRow,
          color,
          id: `branch-${node.commit.hash}`,
          refs: node.commit.refs
        })
        hashToCollapsedRow.set(node.commit.hash, branchRow)
        segmentStart++

        // Now count commits until next interesting point
        let count = 0
        let forkHash: string | null = null
        while (segmentStart < nodes.length) {
          const n = nodes[segmentStart]
          const nHasRefs = n.commit.refs.length > 0
          const nIsFork = isForkPoint(n.commit.hash)

          if (nHasRefs) break // next branch label
          if (nIsFork) {
            forkHash = n.commit.hash
            count++ // the fork commit itself counts
            segmentStart++
            break
          }
          count++
          segmentStart++
        }

        if (count > 0) {
          const groupRow = nextRow++
          collapsedNodes.push({
            kind: 'group',
            label: `${count} commit${count > 1 ? 's' : ''}`,
            column: col,
            row: groupRow,
            color,
            id: `group-${col}-${branchRow}`,
            commitCount: count
          })
          // Edge from branch label to group
          collapsedEdges.push({
            fromRow: branchRow, fromCol: col, toRow: groupRow, toCol: col,
            color, type: 'straight'
          })
          if (forkHash) {
            hashToCollapsedRow.set(forkHash, groupRow)
            emittedForks.add(forkHash)
          }
        }
      } else if (isFork && !emittedForks.has(node.commit.hash)) {
        // Fork point without refs — count commits from here
        segmentStart++
        let count = 1 // the fork commit itself
        emittedForks.add(node.commit.hash)

        while (segmentStart < nodes.length) {
          const n = nodes[segmentStart]
          if (n.commit.refs.length > 0 || isForkPoint(n.commit.hash)) break
          count++
          segmentStart++
        }

        const groupRow = nextRow++
        collapsedNodes.push({
          kind: 'group',
          label: `${count} commit${count > 1 ? 's' : ''}`,
          column: col,
          row: groupRow,
          color,
          id: `group-${col}-${node.commit.hash}`,
          commitCount: count
        })
        hashToCollapsedRow.set(node.commit.hash, groupRow)
      } else {
        // Regular commit, not interesting on its own — accumulate until next interesting
        segmentStart++
        let count = 1

        while (segmentStart < nodes.length) {
          const n = nodes[segmentStart]
          if (n.commit.refs.length > 0 || isForkPoint(n.commit.hash)) break
          count++
          segmentStart++
        }

        if (count > 0) {
          const groupRow = nextRow++
          collapsedNodes.push({
            kind: 'group',
            label: `${count} commit${count > 1 ? 's' : ''}`,
            column: col,
            row: groupRow,
            color,
            id: `group-${col}-${node.commit.hash}`,
            commitCount: count
          })
          hashToCollapsedRow.set(node.commit.hash, groupRow)
        }
      }
    }

    // Connect consecutive collapsed nodes in this column
    const colCollapsed = collapsedNodes.filter(n => n.column === col)
    for (let i = 0; i < colCollapsed.length - 1; i++) {
      // Avoid duplicate edges (branch→group already added)
      const from = colCollapsed[i]
      const to = colCollapsed[i + 1]
      const exists = collapsedEdges.some(
        e => e.fromRow === from.row && e.toRow === to.row && e.fromCol === col && e.toCol === col
      )
      if (!exists) {
        collapsedEdges.push({
          fromRow: from.row, fromCol: col, toRow: to.row, toCol: col,
          color, type: 'straight'
        })
      }
    }
  }

  // Add cross-column fork edges: where a branch's first commit's parent is in another column
  for (const col of sortedCols) {
    const nodes = columnNodes.get(col)!
    if (nodes.length === 0) continue
    const firstInCol = nodes[0]
    // Find the parent that's in a different column (the fork source)
    for (const parentHash of firstInCol.commit.parents) {
      const parentCol = hashToCol.get(parentHash)
      if (parentCol !== undefined && parentCol !== col) {
        const fromRow = hashToCollapsedRow.get(parentHash)
        const toRow = hashToCollapsedRow.get(firstInCol.commit.hash)
          ?? collapsedNodes.find(n => n.column === col)?.row
        if (fromRow !== undefined && toRow !== undefined) {
          collapsedEdges.push({
            fromRow, fromCol: parentCol, toRow, toCol: col,
            color: getColor(col), type: 'curve'
          })
        }
      }
    }
  }

  return { nodes: collapsedNodes, edges: collapsedEdges, maxColumn: fullLayout.maxColumn }
}

// --- Tips mode layout (backward-compat for BranchTab) ---

interface TipsLayout {
  nodes: Array<{ node: GraphNode; row: number }>
  edges: LayoutEdge[]
  maxColumn: number
}

function computeTipsLayout(nodes: GraphNode[], maxColumns: number): TipsLayout {
  const layoutNodes = nodes.map((node, i) => ({ node, row: i }))

  const columnRanges: Record<number, { first: number; last: number }> = {}
  for (let i = 0; i < nodes.length; i++) {
    const col = nodes[i].column
    if (!(col in columnRanges)) {
      columnRanges[col] = { first: i, last: i }
    } else {
      columnRanges[col].last = i
    }
  }

  const edges: LayoutEdge[] = []
  for (let col = 0; col < maxColumns; col++) {
    const range = columnRanges[col]
    if (!range) continue
    edges.push({
      fromRow: range.first, fromCol: col, toRow: range.last, toCol: col,
      color: getColor(col), type: 'straight'
    })
  }

  for (const { node, row } of layoutNodes) {
    if (node.type === 'fork-point' && maxColumns > 1) {
      // Connect fork point to the last node in the branch column (col 1)
      const branchRange = columnRanges[maxColumns - 1]
      const targetRow = branchRange ? branchRange.last : row
      edges.push({
        fromRow: row, fromCol: node.column, toRow: targetRow, toCol: maxColumns - 1,
        color: getColor(1), type: 'curve'
      })
    }
  }

  return { nodes: layoutNodes, edges, maxColumn: maxColumns - 1 }
}

// --- Copy hash hook ---

function useCopyHash() {
  const [copiedHash, setCopiedHash] = useState<string | null>(null)
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const handleCopy = useCallback((hash: string) => {
    navigator.clipboard.writeText(hash)
    setCopiedHash(hash)
    clearTimeout(copiedTimer.current)
    copiedTimer.current = setTimeout(() => setCopiedHash(null), 1500)
  }, [])

  return { copiedHash, handleCopy }
}

// --- SVG rendering helpers ---

function SvgStraightEdge({ edge }: { edge: LayoutEdge }) {
  return (
    <line
      x1={colX(edge.fromCol)} y1={rowY(edge.fromRow)}
      x2={colX(edge.toCol)} y2={rowY(edge.toRow)}
      stroke={edge.color} strokeWidth={2} opacity={0.35}
    />
  )
}

function SvgCurveEdge({ edge }: { edge: LayoutEdge }) {
  const x1 = colX(edge.fromCol), y1 = rowY(edge.fromRow)
  const x2 = colX(edge.toCol), y2 = rowY(edge.toRow)

  if (edge.fromRow === edge.toRow) {
    return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={edge.color} strokeWidth={2} opacity={0.35} />
  }

  const dy = y2 - y1
  const d = `M${x1},${y1} C${x1},${y1 + dy * 0.4} ${x2},${y2 - dy * 0.4} ${x2},${y2}`
  return <path d={d} stroke={edge.color} strokeWidth={2} fill="none" opacity={0.35} />
}

function SvgDot({ cx, cy, color, type, dimmed }: { cx: number; cy: number; color: string; type: 'tip' | 'merge' | 'regular'; dimmed?: boolean }) {
  const opacity = dimmed ? 0.2 : undefined
  if (type === 'merge') {
    return (
      <g opacity={opacity}>
        <circle cx={cx} cy={cy} r={MERGE_DOT_OUTER} fill="none" stroke={color} strokeWidth={2} />
        <circle cx={cx} cy={cy} r={MERGE_DOT_INNER} fill="var(--background, #1a1a1a)" />
      </g>
    )
  }
  if (type === 'tip') {
    return (
      <g opacity={opacity}>
        <circle cx={cx} cy={cy} r={DOT_RADIUS + 1} fill={color} />
        <circle cx={cx} cy={cy} r={DOT_RADIUS + 4} fill={color} opacity={0.15} />
      </g>
    )
  }
  return <circle cx={cx} cy={cy} r={DOT_RADIUS} fill={color} opacity={opacity} />
}

// --- Row renderers ---

function CommitRow({
  shortHash, message, author, relativeDate, refs, color, gutterWidth, copiedHash, onCopy, dimmed
}: {
  shortHash: string; message: string; author: string; relativeDate: string
  refs?: string[]; color: string; gutterWidth: number
  copiedHash: string | null; onCopy: (hash: string) => void; dimmed?: boolean
}) {
  return (
    <div
      className={cn('flex items-center group hover:bg-accent/50 rounded transition-colors cursor-pointer', dimmed && 'opacity-20')}
      style={{ height: ROW_HEIGHT, paddingLeft: gutterWidth }}
      onClick={() => onCopy(shortHash)}
      title="Click to copy hash"
    >
      <div className="flex-1 min-w-0 flex items-center gap-2 pr-3">
        <div className="flex-1 min-w-0">
          <div className="text-xs truncate">
            {refs && refs.map(ref => (
              <span key={ref} className="inline-block px-1.5 py-0 rounded text-[10px] font-medium mr-1.5"
                style={{ backgroundColor: `${color}20`, color }}>{ref}</span>
            ))}
            {message}
          </div>
          <div className="text-[10px] text-muted-foreground">
            <span className="font-mono">{shortHash}</span>{' · '}{author}{' · '}{relativeDate}
          </div>
        </div>
        {copiedHash === shortHash
          ? <Check className="h-3 w-3 text-green-500 shrink-0" />
          : <Copy className="h-3 w-3 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        }
      </div>
    </div>
  )
}

function BranchLabelRow({ refs, color, gutterWidth }: {
  refs: string[]; color: string; gutterWidth: number
}) {
  return (
    <div className="flex items-center" style={{ height: ROW_HEIGHT, paddingLeft: gutterWidth }}>
      <div className="flex items-center gap-1.5">
        {refs.map(ref => (
          <span key={ref} className="inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold"
            style={{ backgroundColor: `${color}25`, color, border: `1px solid ${color}40` }}>{ref}</span>
        ))}
      </div>
    </div>
  )
}

function CommitGroupRow({ count, color, gutterWidth }: {
  count: number; color: string; gutterWidth: number
}) {
  return (
    <div className="flex items-center" style={{ height: ROW_HEIGHT, paddingLeft: gutterWidth }}>
      <span className="text-[10px] px-2 py-0.5 rounded border"
        style={{ borderColor: `${color}30`, color: `${color}aa`, backgroundColor: `${color}08` }}>
        {count} commit{count > 1 ? 's' : ''}
      </span>
    </div>
  )
}

// --- Main component ---

export function BranchGraph(props: BranchGraphProps) {
  const { copiedHash, handleCopy } = useCopyHash()

  if (props.mode === 'dag') {
    return <DagGraph commits={props.commits} filterQuery={props.filterQuery} tipsOnly={props.tipsOnly}
      className={props.className} copiedHash={copiedHash} onCopy={handleCopy} />
  }
  return <TipsGraph nodes={props.nodes} maxColumns={props.maxColumns}
    className={props.className} copiedHash={copiedHash} onCopy={handleCopy} />
}

// --- DAG mode ---

function DagGraph({ commits, filterQuery, tipsOnly, className, copiedHash, onCopy }: {
  commits: DagCommit[]; filterQuery?: string; tipsOnly?: boolean
  className?: string; copiedHash: string | null; onCopy: (hash: string) => void
}) {
  const fullLayout = useMemo(() => computeDagLayout(commits), [commits])
  const collapsed = useMemo(
    () => tipsOnly ? computeCollapsedLayout(commits, fullLayout) : null,
    [commits, fullLayout, tipsOnly]
  )

  // Filter dimming — must be before any early return (hooks rule)
  const matchSet = useMemo(() => {
    if (!filterQuery) return null
    const q = filterQuery.toLowerCase()
    const set = new Set<string>()
    for (const c of commits) {
      if (c.message.toLowerCase().includes(q) || c.author.toLowerCase().includes(q) ||
        c.refs.some(r => r.toLowerCase().includes(q))) {
        set.add(c.hash)
      }
    }
    return set
  }, [commits, filterQuery])

  if (collapsed) {
    return <CollapsedGraph layout={collapsed} className={className} />
  }

  const gutterWidth = (fullLayout.maxColumn + 1) * COLUMN_WIDTH + GUTTER_PAD
  const totalHeight = fullLayout.nodes.length * ROW_HEIGHT

  return (
    <div className={cn('relative', className)}>
      <svg className="absolute top-0 left-0 pointer-events-none" width={gutterWidth} height={totalHeight} style={{ zIndex: 0 }}>
        {fullLayout.edges.map((edge, i) => {
          if (edge.toRow === -1) return null
          return edge.type === 'straight'
            ? <SvgStraightEdge key={`e-${i}`} edge={edge} />
            : <SvgCurveEdge key={`e-${i}`} edge={edge} />
        })}
        {fullLayout.nodes.map((node) => {
          const cx = colX(node.column), cy = rowY(node.row)
          const color = getColor(node.column)
          const dotType = node.isBranchTip ? 'tip' : node.isMerge ? 'merge' : 'regular'
          const dimmed = matchSet !== null && !matchSet.has(node.commit.hash)
          return <SvgDot key={node.commit.hash} cx={cx} cy={cy} color={color} type={dotType} dimmed={dimmed} />
        })}
      </svg>
      {fullLayout.nodes.map((node) => {
        const dimmed = matchSet !== null && !matchSet.has(node.commit.hash)
        return (
          <CommitRow key={node.commit.hash}
            shortHash={node.commit.shortHash} message={node.commit.message}
            author={node.commit.author} relativeDate={node.commit.relativeDate}
            refs={node.commit.refs.length > 0 ? node.commit.refs : undefined}
            color={getColor(node.column)} gutterWidth={gutterWidth}
            copiedHash={copiedHash} onCopy={onCopy} dimmed={dimmed} />
        )
      })}
    </div>
  )
}

// --- Collapsed graph renderer ---

function CollapsedGraph({ layout, className }: { layout: CollapsedLayout; className?: string }) {
  const gutterWidth = (layout.maxColumn + 1) * COLUMN_WIDTH + GUTTER_PAD
  const totalHeight = layout.nodes.length * ROW_HEIGHT

  return (
    <div className={cn('relative', className)}>
      <svg className="absolute top-0 left-0 pointer-events-none" width={gutterWidth} height={totalHeight} style={{ zIndex: 0 }}>
        {layout.edges.map((edge, i) => (
          edge.type === 'straight'
            ? <SvgStraightEdge key={`e-${i}`} edge={edge} />
            : <SvgCurveEdge key={`e-${i}`} edge={edge} />
        ))}
        {layout.nodes.map((node) => {
          const cx = colX(node.column), cy = rowY(node.row)
          if (node.kind === 'branch') {
            return <SvgDot key={node.id} cx={cx} cy={cy} color={node.color} type="tip" />
          }
          return <SvgDot key={node.id} cx={cx} cy={cy} color={node.color} type="regular" />
        })}
      </svg>
      {layout.nodes.map((node) => {
        if (node.kind === 'branch') {
          return <BranchLabelRow key={node.id} refs={node.refs!} color={node.color} gutterWidth={gutterWidth} />
        }
        return <CommitGroupRow key={node.id} count={node.commitCount!} color={node.color} gutterWidth={gutterWidth} />
      })}
    </div>
  )
}

// --- Tips mode (backward-compat for BranchTab) ---

function TipsGraph({ nodes, maxColumns, className, copiedHash, onCopy }: {
  nodes: GraphNode[]; maxColumns: number; className?: string
  copiedHash: string | null; onCopy: (hash: string) => void
}) {
  const layout = useMemo(() => computeTipsLayout(nodes, maxColumns), [nodes, maxColumns])
  const gutterWidth = (layout.maxColumn + 1) * COLUMN_WIDTH + GUTTER_PAD
  const totalHeight = nodes.length * ROW_HEIGHT

  return (
    <div className={cn('relative', className)}>
      <svg className="absolute top-0 left-0 pointer-events-none" width={gutterWidth} height={totalHeight} style={{ zIndex: 0 }}>
        {layout.edges.map((edge, i) => (
          edge.type === 'straight'
            ? <SvgStraightEdge key={`e-${i}`} edge={edge} />
            : <SvgCurveEdge key={`e-${i}`} edge={edge} />
        ))}
        {layout.nodes.map(({ node, row }) => {
          const cx = colX(node.column), cy = rowY(row)
          const color = getColor(node.column)
          const dotType = node.type === 'branch-tip' ? 'tip' : node.type === 'fork-point' ? 'merge' : 'regular'
          return <SvgDot key={`${node.commit.hash}-${row}`} cx={cx} cy={cy} color={color} type={dotType} />
        })}
      </svg>
      {layout.nodes.map(({ node, row }) => (
        <CommitRow key={`${node.commit.hash}-${row}`}
          shortHash={node.commit.shortHash} message={node.commit.message}
          author={node.commit.author} relativeDate={node.commit.relativeDate}
          refs={node.branchLabel ? [node.branchLabel] : undefined}
          color={getColor(node.column)} gutterWidth={gutterWidth}
          copiedHash={copiedHash} onCopy={onCopy} />
      ))}
    </div>
  )
}
