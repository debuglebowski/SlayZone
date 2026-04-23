import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, ListTree } from 'lucide-react'
import { cn } from '@slayzone/ui'
import { PtyStateDot } from '@slayzone/terminal'
import type { TerminalMode } from '@slayzone/terminal/shared'

const WIDTH_STORAGE_KEY = 'slayzone:manager-sidebar-width'
const MIN_WIDTH = 160
const MAX_WIDTH = 480
const DEFAULT_WIDTH = 240

function loadWidth(): number {
  if (typeof window === 'undefined') return DEFAULT_WIDTH
  const raw = window.localStorage?.getItem(WIDTH_STORAGE_KEY)
  const n = raw ? Number.parseInt(raw, 10) : NaN
  if (!Number.isFinite(n)) return DEFAULT_WIDTH
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, n))
}

// Minimal shape of a Task we use here. Avoid importing @slayzone/task/shared
// to prevent a circular package dep (task depends on task-terminals).
export interface ManagerTask {
  id: string
  parent_id: string | null
  title: string
  worktree_path: string | null
  base_dir: string | null
  terminal_mode: TerminalMode
}

export interface ManagerSidebarProps {
  rootTaskId: string
  rootTitle: string
  selectedTaskId: string | null
  /** null = root (parent) selected; otherwise the selected subtask */
  onSelect: (task: ManagerTask | null) => void
  /** Click handler for the manager-mode toggle button rendered in the sidebar header. */
  onToggleOff?: () => void
}

interface TreeNode {
  task: ManagerTask
  children: TreeNode[]
  depth: number
}

function buildTree(rows: ManagerTask[], rootId: string): TreeNode[] {
  const byParent = new Map<string, ManagerTask[]>()
  for (const t of rows) {
    const p = t.parent_id ?? ''
    const arr = byParent.get(p) ?? []
    arr.push(t)
    byParent.set(p, arr)
  }
  const walk = (parentId: string, depth: number): TreeNode[] => {
    const kids = byParent.get(parentId) ?? []
    return kids.map((task) => ({
      task,
      children: walk(task.id, depth + 1),
      depth,
    }))
  }
  return walk(rootId, 0)
}

function NodeRow({
  node,
  selectedTaskId,
  onSelect,
}: {
  node: TreeNode
  selectedTaskId: string | null
  onSelect: (task: ManagerTask) => void
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(true)
  const sessionId = `${node.task.id}:${node.task.id}`
  const hasChildren = node.children.length > 0
  const isSelected = selectedTaskId === node.task.id

  return (
    <>
      <button
        type="button"
        data-testid={`manager-node-${node.task.id}`}
        onClick={() => onSelect(node.task)}
        className={cn(
          'w-full flex items-center gap-1.5 h-7 pr-2 rounded-md text-left text-sm shrink-0 transition-colors',
          isSelected
            ? 'bg-tab-active text-foreground'
            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
        )}
        style={{ paddingLeft: 4 + node.depth * 12 }}
      >
        {hasChildren ? (
          <span
            role="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation()
              setExpanded((v) => !v)
            }}
            className="shrink-0 flex items-center justify-center size-4 rounded hover:bg-accent/40"
          >
            <ChevronRight
              className={cn('size-3 transition-transform', expanded && 'rotate-90')}
            />
          </span>
        ) : (
          <span className="shrink-0 size-4" />
        )}
        <PtyStateDot sessionId={sessionId} />
        <span className="truncate flex-1">{node.task.title || 'Untitled'}</span>
      </button>
      {expanded &&
        node.children.map((child) => (
          <NodeRow
            key={child.task.id}
            node={child}
            selectedTaskId={selectedTaskId}
            onSelect={onSelect}
          />
        ))}
    </>
  )
}

export function ManagerSidebar({
  rootTaskId,
  rootTitle,
  selectedTaskId,
  onSelect,
  onToggleOff,
}: ManagerSidebarProps): React.JSX.Element {
  const [descendants, setDescendants] = useState<ManagerTask[]>([])

  useEffect(() => {
    let cancelled = false
    const refresh = (): void => {
      window.api.db
        .getSubTasksRecursive(rootTaskId)
        .then((rows) => {
          if (!cancelled) setDescendants(rows as unknown as ManagerTask[])
        })
        .catch(() => {})
    }
    refresh()
    const cleanup = window.api?.app?.onTasksChanged?.(refresh)
    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [rootTaskId])

  const tree = useMemo(() => buildTree(descendants, rootTaskId), [descendants, rootTaskId])
  const rootSessionId = `${rootTaskId}:${rootTaskId}`
  const isRootSelected = selectedTaskId === null || selectedTaskId === rootTaskId

  const [width, setWidth] = useState<number>(loadWidth)
  const dragStartRef = useRef<{ x: number; startWidth: number } | null>(null)

  useEffect(() => {
    try { window.localStorage?.setItem(WIDTH_STORAGE_KEY, String(width)) } catch { /* ignore */ }
  }, [width])

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragStartRef.current = { x: e.clientX, startWidth: width }
    const onMove = (ev: MouseEvent) => {
      const start = dragStartRef.current
      if (!start) return
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, start.startWidth + (ev.clientX - start.x)))
      setWidth(next)
    }
    const onUp = () => {
      dragStartRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [width])

  return (
    <div
      data-testid="manager-sidebar"
      style={{ width }}
      className="relative shrink-0 h-full"
    >
      <div className="h-full bg-surface-1 border-r border-border flex flex-col">
        <div className="flex items-center h-10 pl-3 pr-2 gap-2 border-b border-border shrink-0">
          <span className="text-sm font-medium truncate flex-1">Agent overview</span>
          {onToggleOff && (
            <button
              type="button"
              data-testid="terminal-manager-toggle"
              className={cn(
                'flex items-center justify-center h-7 w-7 rounded-md shrink-0 cursor-pointer transition-all select-none',
                'bg-surface-2 dark:bg-surface-2/50 hover:bg-accent/80 dark:hover:bg-accent/50 text-muted-foreground'
              )}
              onClick={onToggleOff}
              title="Manager mode"
              aria-pressed="true"
            >
              <ListTree className="size-4" />
            </button>
          )}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-1">
          <button
            type="button"
            data-testid="manager-node-root"
            onClick={() => onSelect(null)}
            style={{ paddingLeft: 4 }}
            className={cn(
              'w-full flex items-center gap-1.5 h-7 pr-2 rounded-md text-left text-sm shrink-0 transition-colors',
              isRootSelected
                ? 'bg-tab-active text-foreground'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
            )}
          >
            <span className="shrink-0 size-4" />
            <PtyStateDot sessionId={rootSessionId} />
            <span className="truncate flex-1 font-medium">{rootTitle || 'Main'}</span>
          </button>
          {tree.map((node) => (
            <NodeRow
              key={node.task.id}
              node={node}
              selectedTaskId={selectedTaskId}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>
      <div
        data-testid="manager-sidebar-resize"
        onMouseDown={handleResizeStart}
        className="absolute top-0 right-0 h-full w-1 -mr-0.5 cursor-col-resize hover:bg-ring/60 active:bg-ring z-10"
        role="separator"
        aria-orientation="vertical"
      />
    </div>
  )
}
