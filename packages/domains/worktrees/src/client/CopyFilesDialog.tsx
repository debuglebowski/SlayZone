import { useState, useEffect, useCallback } from 'react'
import { Loader2, Folder, File, ChevronRight, Settings, FolderCheck, FolderX } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
  Button, Checkbox
} from '@slayzone/ui'
import type { IgnoredFileNode } from '../shared/types'

interface CopyFilesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  repoPath: string
  projectId?: string
  onConfirm: (selectedPaths: string[], remember: boolean) => void
}

type View = 'choose' | 'select'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const val = bytes / Math.pow(1024, i)
  return `${val < 10 ? val.toFixed(1) : Math.round(val)} ${units[i]}`
}

function TreeRow({ node, depth, expanded, onToggleExpand }: {
  node: IgnoredFileNode
  depth: number
  expanded: Set<string>
  onToggleExpand: (path: string) => void
}) {
  const isExpanded = expanded.has(node.path)

  return (
    <>
      <div
        className="flex items-center gap-1.5 py-0.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
      >
        {node.isDirectory ? (
          <button
            type="button"
            onClick={() => onToggleExpand(node.path)}
            className="flex items-center gap-1.5 min-w-0 flex-1 text-left"
          >
            <ChevronRight className={`h-3 w-3 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
            <Folder className="h-3.5 w-3.5 shrink-0 text-blue-400" />
            <span className="truncate">{node.name}/</span>
            <span className="ml-auto shrink-0 text-[10px] opacity-70">
              {node.fileCount.toLocaleString()} file{node.fileCount !== 1 ? 's' : ''}
            </span>
          </button>
        ) : (
          <span className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="w-3" />
            <File className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{node.name}</span>
            {node.size > 0 && (
              <span className="ml-auto shrink-0 text-[10px] opacity-70">{formatBytes(node.size)}</span>
            )}
          </span>
        )}
      </div>
      {isExpanded && node.children.map(child => (
        <TreeRow key={child.path} node={child} depth={depth + 1} expanded={expanded} onToggleExpand={onToggleExpand} />
      ))}
    </>
  )
}

export function CopyFilesDialog({ open, onOpenChange, repoPath, projectId, onConfirm }: CopyFilesDialogProps) {
  const [view, setView] = useState<View>('choose')
  const [tree, setTree] = useState<IgnoredFileNode[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [remember, setRemember] = useState(false)
  const [loading, setLoading] = useState(false)

  const topLevelNames = tree.map(n => n.name)

  useEffect(() => {
    if (!open) return
    setView('choose')
    setRemember(false)
    setExpanded(new Set())
    setTree([])
  }, [open])

  const loadTree = useCallback(() => {
    setLoading(true)
    setView('select')
    window.api.git.getIgnoredFileTree(repoPath).then(nodes => {
      setTree(nodes)
      const preSelected = new Set<string>()
      for (const node of nodes) {
        if (!node.isDirectory) preSelected.add(node.name)
      }
      setSelected(preSelected)
      setLoading(false)
    })
  }, [repoPath])

  const toggle = useCallback((name: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }, [])

  const toggleAll = () => {
    if (selected.size === topLevelNames.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(topLevelNames))
    }
  }

  const toggleExpand = useCallback((path: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Copy ignored files to worktree?</DialogTitle>
          <DialogDescription>
            Git-ignored files (node_modules, .env, etc.) aren't included in new worktrees.
          </DialogDescription>
        </DialogHeader>

        {view === 'choose' ? (
          <div className="flex flex-col gap-2 py-2">
            <button
              type="button"
              onClick={loadTree}
              className="flex items-center gap-3 rounded-lg border p-3 text-left hover:bg-muted transition-colors"
            >
              <FolderCheck className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <div className="text-sm font-medium">Select files</div>
                <div className="text-xs text-muted-foreground">Choose which ignored files to copy</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => onConfirm([], false)}
              className="flex items-center gap-3 rounded-lg border p-3 text-left hover:bg-muted transition-colors"
            >
              <FolderX className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <div className="text-sm font-medium">Create without copying</div>
                <div className="text-xs text-muted-foreground">Skip copying ignored files</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                onOpenChange(false)
                if (projectId) {
                  window.dispatchEvent(new CustomEvent('open-project-settings', { detail: { projectId, tab: 'worktrees' } }))
                } else {
                  window.dispatchEvent(new CustomEvent('open-settings', { detail: 'worktrees' }))
                }
              }}
              className="flex items-center gap-3 rounded-lg border p-3 text-left hover:bg-muted transition-colors"
            >
              <Settings className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <div className="text-sm font-medium">Go to settings</div>
                <div className="text-xs text-muted-foreground">Configure default behavior</div>
              </div>
            </button>
          </div>
        ) : (
          <>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : tree.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No ignored files found.</p>
            ) : (
              <div className="flex flex-col gap-3 min-h-0 flex-1">
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {selected.size === topLevelNames.length ? 'Deselect all' : 'Select all'}
                </button>
                <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border p-2">
                  {tree.map(node => (
                    <div key={node.name}>
                      <div className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted transition-colors">
                        <Checkbox
                          checked={selected.has(node.name)}
                          onCheckedChange={() => toggle(node.name)}
                        />
                        {node.isDirectory ? (
                          <button
                            type="button"
                            onClick={() => toggleExpand(node.path)}
                            className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
                          >
                            <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform ${expanded.has(node.path) ? 'rotate-90' : ''}`} />
                            <Folder className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                            <span className="text-sm font-mono flex-1 truncate">{node.name}/</span>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {node.fileCount.toLocaleString()} file{node.fileCount !== 1 ? 's' : ''}
                            </span>
                          </button>
                        ) : (
                          <span className="flex items-center gap-1.5 flex-1 min-w-0">
                            <span className="w-3.5" />
                            <File className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-sm font-mono flex-1 truncate">{node.name}</span>
                            {node.size > 0 && (
                              <span className="text-xs text-muted-foreground shrink-0">{formatBytes(node.size)}</span>
                            )}
                          </span>
                        )}
                      </div>
                      {expanded.has(node.path) && node.children.map(child => (
                        <TreeRow key={child.path} node={child} depth={1} expanded={expanded} onToggleExpand={toggleExpand} />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
              Remember for this project
            </label>

            <DialogFooter>
              <Button variant="outline" onClick={() => setView('choose')}>
                Back
              </Button>
              <Button
                onClick={() => onConfirm([...selected], remember)}
                disabled={selected.size === 0}
              >
                Copy and create
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
