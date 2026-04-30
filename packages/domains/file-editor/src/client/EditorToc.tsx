import { useCallback, useMemo, useRef, useState } from 'react'
import { GripHorizontal } from 'lucide-react'
import { cn } from '@slayzone/ui'
import { parseMarkdownHeadings, type MarkdownHeading } from './markdown-headings'
import { MINIMAP_GUTTER_PX } from './cm-shared-themes'

const ANCHOR_INSET_PX = 16
const MINIMAP_GAP_PX = 60

interface EditorTocProps {
  content: string
  width: number
  onWidthChange: (w: number) => void
  onJump: (heading: MarkdownHeading) => void
  /** When true, TOC is offset left to clear CM minimap gutter */
  minimapVisible?: boolean
}

// Tree layout constants — mirror ManagerSidebar.
const INDENT = 14
const ROW_HEIGHT = 32
const CURVE_R = 5
const ELBOW_END_OFFSET = INDENT / 2
const ROOT_X = 10
function guideXForAncestor(ancestorDepth: number): number {
  return ROOT_X + INDENT * ancestorDepth
}

interface TocRow {
  heading: MarkdownHeading
  depth: number
  ancestorFlags: boolean[]
}

function computeRows(headings: MarkdownHeading[]): TocRow[] {
  if (headings.length === 0) return []
  const minLevel = Math.min(...headings.map((h) => h.level))

  // Build tree.
  interface Node { heading: MarkdownHeading; depth: number; children: Node[] }
  const root: Node = { heading: null as unknown as MarkdownHeading, depth: -1, children: [] }
  const stack: Node[] = [root]
  for (const h of headings) {
    const depth = h.level - minLevel
    while (stack.length > 1 && stack[stack.length - 1].depth >= depth) stack.pop()
    const node: Node = { heading: h, depth, children: [] }
    stack[stack.length - 1].children.push(node)
    stack.push(node)
  }

  // Walk to flat rows w/ ancestorFlags.
  const rows: TocRow[] = []
  function walk(node: Node, ancestorFlags: boolean[]): void {
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i]
      const isLast = i === node.children.length - 1
      if (child.depth >= 0) rows.push({ heading: child.heading, depth: child.depth, ancestorFlags })
      walk(child, [...ancestorFlags, !isLast])
    }
  }
  walk(root, [])
  return rows
}

function TreeGuides({ depth, ancestorFlags }: { depth: number; ancestorFlags: boolean[] }) {
  if (depth <= 0) return null
  const parentX = guideXForAncestor(depth - 1)
  const mid = ROW_HEIGHT / 2
  const r = CURVE_R
  const endX = parentX + ELBOW_END_OFFSET
  const isLast = !ancestorFlags[depth - 1]

  const connector =
    `M ${parentX} 0 V ${mid - r} Q ${parentX} ${mid} ${parentX + r} ${mid} H ${endX}` +
    (isLast ? '' : ` M ${parentX} ${mid - r} V ${ROW_HEIGHT}`)

  const svgWidth = endX + 2
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute top-0 left-0"
      width={svgWidth}
      height={ROW_HEIGHT}
    >
      {ancestorFlags.slice(0, -1).map((flag, a) =>
        flag ? (
          <line
            key={a}
            x1={guideXForAncestor(a)}
            x2={guideXForAncestor(a)}
            y1={0}
            y2={ROW_HEIGHT}
            stroke="var(--border)"
            strokeWidth={1}
          />
        ) : null
      )}
      <path d={connector} fill="none" stroke="var(--border)" strokeWidth={1} />
    </svg>
  )
}

export function EditorToc({ content, width, onWidthChange, onJump, minimapVisible }: EditorTocProps) {
  const headings = useMemo(() => parseMarkdownHeadings(content), [content])
  const rows = useMemo(() => computeRows(headings), [headings])
  const isDragging = useRef(false)
  const isMoving = useRef(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    const startX = e.clientX
    const startWidth = width
    const anchored = pos === null

    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return
      const delta = ev.clientX - startX
      // Anchored right (default): drag-left widens. Free-positioned: drag-right widens (left edge fixed).
      const next = anchored ? startWidth - delta : startWidth + delta
      onWidthChange(Math.max(160, Math.min(480, next)))
    }
    const onUp = () => {
      isDragging.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [width, onWidthChange, pos])

  const handleMoveStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const card = cardRef.current
    const parent = card?.offsetParent as HTMLElement | null
    if (!card || !parent) return
    const cardRect = card.getBoundingClientRect()
    const parentRect = parent.getBoundingClientRect()
    const offsetX = e.clientX - cardRect.left
    const offsetY = e.clientY - cardRect.top
    isMoving.current = true

    const onMove = (ev: MouseEvent) => {
      if (!isMoving.current) return
      const left = ev.clientX - parentRect.left - offsetX
      const top = ev.clientY - parentRect.top - offsetY
      const maxLeft = parentRect.width - cardRect.width
      const maxTop = parentRect.height - cardRect.height
      setPos({
        left: Math.max(0, Math.min(maxLeft, left)),
        top: Math.max(0, Math.min(maxTop, top)),
      })
    }
    const onUp = () => {
      isMoving.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  return (
    <div
      ref={cardRef}
      className="absolute z-20 max-h-[60%] rounded-lg border border-border bg-surface-2 shadow-lg overflow-hidden flex flex-col"
      style={
        pos
          ? { width, left: pos.left, top: pos.top }
          : {
              width,
              right: minimapVisible ? MINIMAP_GUTTER_PX + MINIMAP_GAP_PX : ANCHOR_INSET_PX,
              bottom: ANCHOR_INSET_PX,
            }
      }
    >
      <div className="flex-1 min-h-0 overflow-auto p-3 scrollbar-thin">
        {rows.length === 0 ? (
          <div className="px-3 py-2 text-xs text-muted-foreground">No headings</div>
        ) : (
          <ul className="text-sm">
            {rows.map(({ heading, depth, ancestorFlags }) => {
              const textPad = depth === 0 ? 12 : guideXForAncestor(depth - 1) + ELBOW_END_OFFSET + 8
              return (
                <li key={heading.index} className="relative" style={{ height: ROW_HEIGHT }}>
                  <TreeGuides depth={depth} ancestorFlags={ancestorFlags} />
                  <button
                    className={cn(
                      'absolute inset-0 text-left truncate cursor-pointer transition-colors rounded-sm',
                      'hover:bg-accent hover:text-accent-foreground',
                      depth === 0 ? 'font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground'
                    )}
                    style={{ paddingLeft: textPad, paddingRight: 8 }}
                    title={heading.text}
                    onClick={() => onJump(heading)}
                  >
                    {heading.text}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <div
        className="absolute left-0 inset-y-0 w-2 -translate-x-1/2 z-10 cursor-col-resize hover:bg-primary/20 active:bg-primary/30 transition-colors"
        onMouseDown={handleResizeStart}
      />
      <div
        className="shrink-0 flex items-center justify-center h-5 cursor-move border-t border-border text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        onMouseDown={handleMoveStart}
        title="Drag to move"
      >
        <GripHorizontal className="size-3" />
      </div>
    </div>
  )
}
