import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { ChevronRight, ChevronDown, Folder, FolderOpen } from 'lucide-react'
import { cn } from './utils'

// --- Tree types ---

export interface TreeFolder {
  type: 'folder'
  name: string
  path: string
  children: TreeNode<any>[]
}

export interface TreeFile<T> {
  type: 'file'
  name: string
  item: T
}

export type TreeNode<T> = TreeFolder | TreeFile<T>

// --- Tree building ---

export function buildFileTree<T>(
  items: T[],
  getPath: (item: T) => string,
  options?: { compress?: boolean }
): TreeNode<T>[] {
  const root = new Map<string, any>()
  for (const item of items) {
    const parts = getPath(item).split('/')
    let current = root
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current.has(parts[i])) current.set(parts[i], new Map())
      const next = current.get(parts[i])
      if (next instanceof Map) current = next
      else break
    }
    current.set(parts[parts.length - 1], item)
  }

  function toNodes(map: Map<string, any>, prefix: string): TreeNode<T>[] {
    const dirs: TreeFolder[] = []
    const files: TreeFile<T>[] = []
    for (const [name, value] of map) {
      if (value instanceof Map) {
        const dirPath = prefix ? `${prefix}/${name}` : name
        dirs.push({ type: 'folder', name, path: dirPath, children: toNodes(value, dirPath) })
      } else {
        files.push({ type: 'file', name, item: value })
      }
    }
    dirs.sort((a, b) => a.name.localeCompare(b.name))
    files.sort((a, b) => a.name.localeCompare(b.name))
    return [...dirs, ...files]
  }

  const nodes = toNodes(root, '')
  return options?.compress ? compressTree(nodes) : nodes
}

/** Merge single-child directory chains into "a/b/c" labels */
function compressTree<T>(nodes: TreeNode<T>[]): TreeNode<T>[] {
  return nodes.map((node) => {
    if (node.type === 'file') return node
    let n = node
    while (n.children.length === 1 && n.children[0].type === 'folder') {
      const child = n.children[0] as TreeFolder
      n = { type: 'folder', name: `${n.name}/${child.name}`, path: child.path, children: child.children }
    }
    return { ...n, children: compressTree(n.children) }
  })
}

/** Flatten tree to items respecting collapsed folders */
export function flattenFileTree<T>(
  nodes: TreeNode<T>[],
  collapsed: Set<string>
): T[] {
  const result: T[] = []
  for (const node of nodes) {
    if (node.type === 'file') {
      result.push(node.item)
    } else if (!collapsed.has(node.path)) {
      result.push(...flattenFileTree(node.children, collapsed))
    }
  }
  return result
}

// --- Components ---

const INDENT_PX = 20
const BASE_PAD = 4

function FolderRow({
  name,
  expanded,
  depth,
  onClick
}: {
  name: string
  expanded: boolean
  depth: number
  onClick: () => void
}) {
  return (
    <button
      className="group/folder flex w-full select-none items-center gap-1.5 rounded px-1 py-1 text-xs hover:bg-muted/50"
      style={{ paddingLeft: depth * INDENT_PX + BASE_PAD }}
      onClick={onClick}
    >
      <span className="relative size-4 shrink-0">
        {expanded
          ? <FolderOpen className="size-4 text-muted-foreground transition-opacity group-hover/folder:opacity-0" />
          : <Folder className="size-4 text-muted-foreground transition-opacity group-hover/folder:opacity-0" />}
        {expanded
          ? <ChevronDown className="absolute inset-0 m-auto size-3 opacity-0 transition-opacity group-hover/folder:opacity-100" />
          : <ChevronRight className="absolute inset-0 m-auto size-3 opacity-0 transition-opacity group-hover/folder:opacity-100" />}
      </span>
      <span className="truncate font-mono">{name}</span>
    </button>
  )
}

function TreeBranch<T>({
  nodes,
  depth,
  expandedFolders,
  onToggleFolder,
  renderFile
}: {
  nodes: TreeNode<T>[]
  depth: number
  expandedFolders: Set<string>
  onToggleFolder: (path: string) => void
  renderFile: (item: T, info: { name: string; depth: number }) => ReactNode
}) {
  return (
    <>
      {nodes.map((node) => {
        if (node.type === 'folder') {
          const expanded = expandedFolders.has(node.path)
          return (
            <div key={`d:${node.path}`}>
              <FolderRow
                name={node.name}
                expanded={expanded}
                depth={depth}
                onClick={() => onToggleFolder(node.path)}
              />
              {expanded && (
                <TreeBranch
                  nodes={node.children}
                  depth={depth + 1}
                  expandedFolders={expandedFolders}
                  onToggleFolder={onToggleFolder}
                  renderFile={renderFile}
                />
              )}
            </div>
          )
        }
        return (
          <div key={`f:${node.name}`}>
            {renderFile(node.item, { name: node.name, depth })}
          </div>
        )
      })}
    </>
  )
}

export interface FileTreeProps<T> {
  /** Items to display in the tree */
  items: T[]
  /** Extract the slash-separated path from each item */
  getPath: (item: T) => string
  /** Render a file leaf node */
  renderFile: (item: T, info: { name: string; depth: number }) => ReactNode
  /** Merge single-child directory chains (e.g. "a/b/c") */
  compress?: boolean
  /** Controlled expanded folders state */
  expandedFolders?: Set<string>
  /** Controlled toggle handler */
  onToggleFolder?: (path: string) => void
  /** Start with all folders expanded (only for uncontrolled mode) */
  defaultExpanded?: boolean
  className?: string
}

export function FileTree<T>({
  items,
  getPath,
  renderFile,
  compress,
  expandedFolders: controlledExpanded,
  onToggleFolder: controlledToggle,
  defaultExpanded,
  className
}: FileTreeProps<T>) {
  const tree = useMemo(
    () => buildFileTree(items, getPath, { compress }),
    [items, getPath, compress]
  )

  // Collect all folder paths for defaultExpanded
  const allFolderPaths = useMemo(() => {
    if (!defaultExpanded) return new Set<string>()
    const paths = new Set<string>()
    function walk(nodes: TreeNode<T>[]) {
      for (const n of nodes) {
        if (n.type === 'folder') {
          paths.add(n.path)
          walk(n.children)
        }
      }
    }
    walk(tree)
    return paths
  }, [defaultExpanded, tree])

  const [internalExpanded, setInternalExpanded] = useState<Set<string>>(() =>
    defaultExpanded ? new Set(allFolderPaths) : new Set()
  )

  const isControlled = controlledExpanded !== undefined
  const expandedFolders = isControlled ? controlledExpanded : internalExpanded

  const toggleFolder = useCallback((path: string) => {
    if (controlledToggle) {
      controlledToggle(path)
      return
    }
    setInternalExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [controlledToggle])

  if (tree.length === 0) return null

  return (
    <div className={cn('text-sm', className)}>
      <TreeBranch
        nodes={tree}
        depth={0}
        expandedFolders={expandedFolders}
        onToggleFolder={toggleFolder}
        renderFile={renderFile}
      />
    </div>
  )
}

/** Indent padding for file items to align with folder content */
export function fileTreeIndent(depth: number): number {
  return depth * INDENT_PX + BASE_PAD
}
