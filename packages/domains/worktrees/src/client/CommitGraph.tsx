import { cn, Tooltip, TooltipTrigger, TooltipContent } from '@slayzone/ui'
import { Copy, Check } from 'lucide-react'
import { useState, useRef, useCallback, useMemo } from 'react'
import type { CommitInfo, DagCommit } from '../shared/types'

// --- Public interfaces ---

export interface GraphNode {
  commit: CommitInfo
  column: number
  type: 'commit' | 'branch-tip' | 'fork-point'
  branchName?: string
  branchLabel?: string
}

type CommitGraphProps =
  | { mode: 'fork'; nodes: GraphNode[]; maxColumns: number; className?: string }
  | { mode: 'dag'; commits: DagCommit[]; filterQuery?: string; tipsOnly?: boolean; className?: string }

// --- Fork graph builder ---

export function buildForkGraphNodes(opts: {
  column0Commits: CommitInfo[]
  column0Label: string
  column1Commits: CommitInfo[]
  column1Label: string
  forkPoint: string
  preForkCommits: CommitInfo[]
}): { nodes: GraphNode[]; columns: number } {
  const nodes: GraphNode[] = []
  const fp = opts.forkPoint

  // Column 0
  for (let i = 0; i < opts.column0Commits.length; i++) {
    nodes.push({
      commit: opts.column0Commits[i], column: 0,
      type: i === 0 ? 'branch-tip' : 'commit',
      branchName: opts.column0Label, branchLabel: i === 0 ? opts.column0Label : undefined
    })
  }

  // Column 1
  for (let i = 0; i < opts.column1Commits.length; i++) {
    nodes.push({
      commit: opts.column1Commits[i], column: 1,
      type: i === 0 ? 'branch-tip' : 'commit',
      branchName: opts.column1Label, branchLabel: i === 0 ? opts.column1Label : undefined
    })
  }

  // Fork point + pre-fork context
  nodes.push({
    commit: { hash: fp, shortHash: fp.slice(0, 7), message: 'fork point', author: '', relativeDate: '' },
    column: 0, type: 'fork-point'
  })
  for (const c of opts.preForkCommits) {
    nodes.push({ commit: c, column: 0, type: 'commit' })
  }

  return { nodes, columns: opts.column1Commits.length > 0 ? 2 : 1 }
}

// --- Constants ---

const ROW_HEIGHT = 44
const COLUMN_WIDTH = 24
const DOT_RADIUS = 4
const MERGE_DOT_OUTER = 6
const MERGE_DOT_INNER = 3
const GUTTER_PAD = 12

/** Index 0 = base branch (white), rest are for other branches */
const COLUMN_COLORS = [
  '#e2e2e2', // white/light — base branch
  '#a78bfa', // violet
  '#f59e0b', // amber
  '#10b981', // emerald
  '#f472b6', // pink
  '#06b6d4', // cyan
  '#ef4444', // red
  '#8b5cf6', // purple
  '#14b8a6', // teal
  '#f97316', // orange
  'var(--color-primary)',
]

function getColor(index: number): string {
  const len = COLUMN_COLORS.length
  return COLUMN_COLORS[((index % len) + len) % len]
}

/** Deterministic hash of a branch name to a color index (skips 0, reserved for base branch) */
function hashBranchColor(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) - h + name.charCodeAt(i)) | 0
  }
  // Map to 1..N (skip index 0 which is reserved for base branch)
  return (Math.abs(h) % (COLUMN_COLORS.length - 1)) + 1
}

/** Color index for the base/first branch — always white */
const BASE_BRANCH_COLOR_INDEX = 0

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
  colorIndex: number
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
  const columnColorIndex: number[] = []  // current colorIndex per column
  let nextFallbackColor = 0

  // Pre-compute: map each commit hash → branch name by finding the nearest branch tip
  // In topo order, tips come first, so we can walk forward to find which branch owns each commit
  const commitBranchName = new Map<string, string>()
  {
    // First pass: map branch tip commits to their branch name
    for (const c of commits) {
      const branchRef = c.refs.find(r => !r.startsWith('tag:') && r !== 'HEAD')
      if (branchRef) {
        commitBranchName.set(c.hash, branchRef.replace(/^HEAD -> /, ''))
      }
    }
    // Second pass: for merge commits, assign synthetic branch names to second+ parents
    // These represent branches that were merged and had their refs deleted
    const hashToCommit = new Map<string, DagCommit>()
    for (const c of commits) hashToCommit.set(c.hash, c)
    for (const c of commits) {
      if (c.parents.length < 2) continue
      for (let p = 1; p < c.parents.length; p++) {
        const parentHash = c.parents[p]
        if (commitBranchName.has(parentHash)) continue
        // Extract branch name from merge message (e.g. "Merge pull request #2 from user/branch-name")
        const mergeMatch = c.message.match(/from\s+\S+\/(.+)$/) ?? c.message.match(/Merge branch '([^']+)'/)
        const syntheticName = mergeMatch ? mergeMatch[1] : `merged-${c.hash.slice(0, 7)}-p${p}`
        commitBranchName.set(parentHash, syntheticName)
      }
    }
    // Third pass: propagate branch name down through first-parent chain
    for (const c of commits) {
      if (!commitBranchName.has(c.hash)) continue
      const name = commitBranchName.get(c.hash)!
      let current = c
      while (current.parents.length > 0) {
        const parent = hashToCommit.get(current.parents[0])
        if (!parent) break
        // Stop at commits owned by a different branch, but walk through unowned commits (tag-only)
        if (commitBranchName.has(parent.hash) && commitBranchName.get(parent.hash) !== name) break
        commitBranchName.set(parent.hash, name)
        current = parent
      }
    }
  }

  // The first branch tip in topo order is the base branch — give it white
  const baseBranchName = commits.find(c => {
    const ref = c.refs.find(r => !r.startsWith('tag:') && r !== 'HEAD')
    return ref !== undefined
  })?.refs.find(r => !r.startsWith('tag:') && r !== 'HEAD')?.replace(/^HEAD -> /, '')

  function getCommitColorIndex(hash: string): number {
    const name = commitBranchName.get(hash)
    if (name) {
      if (name === baseBranchName) return BASE_BRANCH_COLOR_INDEX
      return hashBranchColor(name)
    }
    return nextFallbackColor++
  }

  function findFreeColumn(): number {
    for (let i = 0; i < activeColumns.length; i++) {
      if (activeColumns[i] === null) return i
    }
    activeColumns.push(null)
    columnColorIndex.push(0)
    return activeColumns.length - 1
  }

  function findColumnReservedFor(hash: string): number | null {
    for (let i = 0; i < activeColumns.length; i++) {
      if (activeColumns[i] === hash) return i
    }
    return null
  }

  const hashToColorIndex = new Map<string, number>()

  function isBaseBranch(hash: string): boolean {
    return baseBranchName !== undefined && commitBranchName.get(hash) === baseBranchName
  }

  for (let row = 0; row < commits.length; row++) {
    const commit = commits[row]
    hashToRow.set(commit.hash, row)

    let col = findColumnReservedFor(commit.hash)

    if (col !== null) {
      // Base branch commits should always stay in column 0
      const isBase = isBaseBranch(commit.hash)
      if (isBase && col !== 0) {
        // Swap: move whatever is in col 0 to the column we found, take col 0
        if (activeColumns[0] === commit.hash) {
          // Column 0 also reserved for this commit — just pick column 0
        } else if (activeColumns[0] !== null) {
          activeColumns[col] = activeColumns[0]
        } else {
          activeColumns[col] = null
        }
        col = 0
      }

      for (let i = 0; i < activeColumns.length; i++) {
        if (i !== col && activeColumns[i] === commit.hash) {
          activeColumns[i] = null
        }
      }
    }

    if (col === null) {
      col = findFreeColumn()
    }

    const ci = getCommitColorIndex(commit.hash)
    columnColorIndex[col] = ci

    hashToCol.set(commit.hash, col)
    hashToColorIndex.set(commit.hash, ci)

    const isMerge = commit.parents.length >= 2
    const isBranchTip = commit.refs.length > 0

    nodes.push({ commit, column: col, row, isMerge, isBranchTip, colorIndex: ci })

    if (commit.parents.length === 0) {
      activeColumns[col] = null
    } else {
      const firstParent = commit.parents[0]
      const existingCol = findColumnReservedFor(firstParent)
      if (existingCol !== null && existingCol !== col) {
        activeColumns[col] = null
        edges.push({
          fromRow: row, fromCol: col, toRow: -1, toCol: existingCol,
          color: getColor(ci), type: 'curve', targetHash: firstParent
        })
      } else if (existingCol === null) {
        activeColumns[col] = firstParent
      }

      for (let p = 1; p < commit.parents.length; p++) {
        const parentHash = commit.parents[p]
        const pExisting = findColumnReservedFor(parentHash)
        if (pExisting === null) {
          const pCol = findFreeColumn()
          const pci = getCommitColorIndex(parentHash)
          columnColorIndex[pCol] = pci
          activeColumns[pCol] = parentHash
          edges.push({
            fromRow: row, fromCol: col, toRow: -1, toCol: pCol,
            color: getColor(pci), type: 'curve', targetHash: parentHash
          })
        } else {
          edges.push({
            fromRow: row, fromCol: col, toRow: -1, toCol: pExisting,
            color: getColor(columnColorIndex[pExisting]), type: 'curve', targetHash: parentHash
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
        color: getColor(hashToColorIndex.get(commit.hash) ?? col), type: 'straight'
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

  function isForkPoint(hash: string): boolean {
    const children = childrenOf.get(hash) || []
    if (children.length < 2) return false
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

  const emittedForks = new Set<string>()
  // Map EVERY commit hash → collapsed row (not just interesting ones)
  const hashToCollapsedRow = new Map<string, number>()

  function mapHashes(hashes: string[], row: number) {
    for (const h of hashes) hashToCollapsedRow.set(h, row)
  }

  const sortedCols = [...columnNodes.keys()].sort((a, b) => a - b)

  for (const col of sortedCols) {
    const nodes = columnNodes.get(col)!

    let segmentStart = 0

    while (segmentStart < nodes.length) {
      const node = nodes[segmentStart]
      const color = getColor(node.colorIndex)
      const hasRefs = node.commit.refs.length > 0
      const isFork = isForkPoint(node.commit.hash)

      if (hasRefs) {
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

        const groupHashes: string[] = []
        while (segmentStart < nodes.length) {
          const n = nodes[segmentStart]
          if (n.commit.refs.length > 0) break
          if (isForkPoint(n.commit.hash)) {
            groupHashes.push(n.commit.hash)
            emittedForks.add(n.commit.hash)
            segmentStart++
            break
          }
          groupHashes.push(n.commit.hash)
          segmentStart++
        }

        if (groupHashes.length > 0) {
          const groupRow = nextRow++
          collapsedNodes.push({
            kind: 'group',
            label: `${groupHashes.length} commit${groupHashes.length > 1 ? 's' : ''}`,
            column: col,
            row: groupRow,
            color,
            id: `group-${col}-${branchRow}`,
            commitCount: groupHashes.length
          })
          collapsedEdges.push({
            fromRow: branchRow, fromCol: col, toRow: groupRow, toCol: col,
            color, type: 'straight'
          })
          mapHashes(groupHashes, groupRow)
        }
      } else if (isFork && !emittedForks.has(node.commit.hash)) {
        segmentStart++
        const groupHashes = [node.commit.hash]
        emittedForks.add(node.commit.hash)

        while (segmentStart < nodes.length) {
          const n = nodes[segmentStart]
          if (n.commit.refs.length > 0 || isForkPoint(n.commit.hash)) break
          groupHashes.push(n.commit.hash)
          segmentStart++
        }

        const groupRow = nextRow++
        collapsedNodes.push({
          kind: 'group',
          label: `${groupHashes.length} commit${groupHashes.length > 1 ? 's' : ''}`,
          column: col,
          row: groupRow,
          color,
          id: `group-${col}-${node.commit.hash}`,
          commitCount: groupHashes.length
        })
        mapHashes(groupHashes, groupRow)
      } else {
        segmentStart++
        const groupHashes = [node.commit.hash]

        while (segmentStart < nodes.length) {
          const n = nodes[segmentStart]
          if (n.commit.refs.length > 0 || isForkPoint(n.commit.hash)) break
          groupHashes.push(n.commit.hash)
          segmentStart++
        }

        if (groupHashes.length > 0) {
          const groupRow = nextRow++
          collapsedNodes.push({
            kind: 'group',
            label: `${groupHashes.length} commit${groupHashes.length > 1 ? 's' : ''}`,
            column: col,
            row: groupRow,
            color,
            id: `group-${col}-${node.commit.hash}`,
            commitCount: groupHashes.length
          })
          mapHashes(groupHashes, groupRow)
        }
      }
    }

    // Connect consecutive collapsed nodes in this column
    const colCollapsed = collapsedNodes.filter(n => n.column === col)
    for (let i = 0; i < colCollapsed.length - 1; i++) {
      const from = colCollapsed[i]
      const to = colCollapsed[i + 1]
      const exists = collapsedEdges.some(
        e => e.fromRow === from.row && e.toRow === to.row && e.fromCol === col && e.toCol === col
      )
      if (!exists) {
        collapsedEdges.push({
          fromRow: from.row, fromCol: col, toRow: to.row, toCol: col,
          color: from.color, type: 'straight'
        })
      }
    }
  }

  // Cross-column fork edges: a commit whose FIRST parent is in a different column
  // marks a fork point (where a branch diverged). Second+ parents are merges, not forks.
  // Deduplicate since multiple commits in the same collapsed group may share the same edge.
  const addedForkEdges = new Set<string>()
  for (const node of fullLayout.nodes) {
    if (node.commit.parents.length === 0) continue
    const firstParent = node.commit.parents[0]
    const parentCol = hashToCol.get(firstParent)
    if (parentCol === undefined || parentCol === node.column) continue

    const fromRow = hashToCollapsedRow.get(firstParent)
    const toRow = hashToCollapsedRow.get(node.commit.hash)
    if (fromRow !== undefined && toRow !== undefined) {
      const key = `${fromRow},${parentCol},${toRow},${node.column}`
      if (!addedForkEdges.has(key)) {
        addedForkEdges.add(key)
        collapsedEdges.push({
          fromRow, fromCol: parentCol, toRow, toCol: node.column,
          color: getColor(node.colorIndex), type: 'curve'
        })
      }
    }
  }

  return { nodes: collapsedNodes, edges: collapsedEdges, maxColumn: fullLayout.maxColumn }
}

// --- Fork mode layout ---

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

// --- Dot tooltip overlay ---

const DOT_HIT_SIZE = 18

function DotOverlays({ items }: { items: Array<{ key: string; row: number; column: number; color: string; branchName?: string }> }) {
  return (
    <>
      {items.map(({ key, row, column, color, branchName }) => {
        if (!branchName) return null
        const cx = colX(column)
        const cy = rowY(row)
        return (
          <Tooltip key={key}>
            <TooltipTrigger asChild>
              <div className="absolute transition-shadow duration-150" style={{
                left: cx - DOT_HIT_SIZE / 2,
                top: cy - DOT_HIT_SIZE / 2,
                width: DOT_HIT_SIZE,
                height: DOT_HIT_SIZE,
                borderRadius: '50%',
                zIndex: 1,
                boxShadow: `0 0 0 0px ${color}50`,
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 0 0 2px ${color}50` }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = `0 0 0 0px ${color}50` }}
              />
            </TooltipTrigger>
            <TooltipContent side="top">{branchName}</TooltipContent>
          </Tooltip>
        )
      })}
    </>
  )
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
      className={cn('flex items-center cursor-pointer', dimmed && 'opacity-20')}
      style={{ height: ROW_HEIGHT, paddingLeft: gutterWidth, paddingTop: 3, paddingBottom: 3 }}
      onClick={() => onCopy(shortHash)}
    >
      <div className="flex-1 min-w-0 flex items-center gap-2 pr-3 h-full rounded group transition-colors px-2"
        style={{ backgroundColor: `${color}12` }}>
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

export function CommitGraph(props: CommitGraphProps) {
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

  // Map colorIndex → branch name from branch refs (skip tags, HEAD pointer)
  const colorBranch = useMemo(() => {
    const map = new Map<number, string>()
    for (const node of fullLayout.nodes) {
      if (map.has(node.colorIndex)) continue
      const branches = node.commit.refs
        .filter(r => !r.startsWith('tag:') && r !== 'HEAD')
        .map(r => r.replace(/^HEAD -> /, ''))
      if (branches.length > 0) {
        map.set(node.colorIndex, branches.join(', '))
      }
    }
    return map
  }, [fullLayout])

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
          const color = getColor(node.colorIndex)
          const dotType = node.isBranchTip ? 'tip' : node.isMerge ? 'merge' : 'regular'
          const dimmed = matchSet !== null && !matchSet.has(node.commit.hash)
          return <SvgDot key={node.commit.hash} cx={cx} cy={cy} color={color} type={dotType} dimmed={dimmed} />
        })}
      </svg>
      <DotOverlays items={fullLayout.nodes.map(node => ({
        key: node.commit.hash, row: node.row, column: node.column,
        color: getColor(node.colorIndex), branchName: colorBranch.get(node.colorIndex)
      }))} />
      {fullLayout.nodes.map((node) => {
        const dimmed = matchSet !== null && !matchSet.has(node.commit.hash)
        return (
          <CommitRow key={node.commit.hash}
            shortHash={node.commit.shortHash} message={node.commit.message}
            author={node.commit.author} relativeDate={node.commit.relativeDate}
            refs={node.commit.refs.length > 0 ? node.commit.refs : undefined}
            color={getColor(node.colorIndex)} gutterWidth={gutterWidth}
            copiedHash={copiedHash} onCopy={onCopy} dimmed={dimmed} />
        )
      })}
      {/* Fade-out at bottom */}
      <div className="h-8 pointer-events-none" style={{
        background: 'linear-gradient(to bottom, var(--color-card), transparent)'
      }} />
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

// --- Fork mode ---

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
      <DotOverlays items={layout.nodes.map(({ node, row }) => ({
        key: `${node.commit.hash}-${row}`, row, column: node.column,
        color: getColor(node.column), branchName: node.branchName
      }))} />
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
