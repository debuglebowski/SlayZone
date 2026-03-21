import { useState, useEffect, useCallback } from 'react'
import { Loader2, Folder, File, ChevronRight } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  Button, Checkbox,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@slayzone/ui'
import { cn } from '@slayzone/ui'
import type { IgnoredFileNode, WorktreeCopyPreset } from '../shared/types'
import { DEFAULT_COPY_PRESETS } from '../shared/types'

export type CopyChoice =
  | { mode: 'none' }
  | { mode: 'custom'; paths: string[] }

interface CopyFilesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  repoPath: string
  onConfirm: (choice: CopyChoice) => void
}

function flattenTree(nodes: IgnoredFileNode[]): string[] {
  const result: string[] = []
  for (const node of nodes) {
    result.push(node.name)
  }
  return result
}

function filterTreeByGlobs(nodes: IgnoredFileNode[], globs: string[]): Set<string> {
  if (globs.length === 0) return new Set(flattenTree(nodes))

  // Split globs into: single-segment (match file/dir name) and multi-segment (match dir by first segment)
  const fileMatchers: RegExp[] = []
  const dirPrefixes: string[] = []
  for (const glob of globs) {
    const firstSlash = glob.indexOf('/')
    if (firstSlash === -1) {
      // Single-segment glob like "*.md" or ".env*"
      fileMatchers.push(globToRegex(glob))
    } else {
      // Multi-segment glob like "docs/**" — extract first segment
      dirPrefixes.push(glob.slice(0, firstSlash))
    }
  }

  const matched = new Set<string>()
  for (const node of nodes) {
    if (fileMatchers.some(re => re.test(node.name))) {
      matched.add(node.name)
    } else if (node.isDirectory && dirPrefixes.includes(node.name)) {
      matched.add(node.name)
    }
  }
  return matched
}

function globToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '\0')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/\0/g, '.*')
  return new RegExp(`^${escaped}$`)
}

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
          <button type="button" onClick={() => onToggleExpand(node.path)} className="flex items-center gap-1.5 min-w-0 flex-1 text-left">
            <ChevronRight className={`h-3 w-3 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
            <Folder className="h-3.5 w-3.5 shrink-0 text-blue-400" />
            <span className="truncate">{node.name}/</span>
            <span className="ml-auto shrink-0 text-[10px] opacity-70">{node.fileCount} file{node.fileCount !== 1 ? 's' : ''}</span>
          </button>
        ) : (
          <span className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="w-3" />
            <File className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{node.name}</span>
            {node.size > 0 && <span className="ml-auto shrink-0 text-[10px] opacity-70">{formatBytes(node.size)}</span>}
          </span>
        )}
      </div>
      {isExpanded && node.children.map(child => (
        <TreeRow key={child.path} node={child} depth={depth + 1} expanded={expanded} onToggleExpand={onToggleExpand} />
      ))}
    </>
  )
}

export function CopyFilesDialog({ open, onOpenChange, repoPath, onConfirm }: CopyFilesDialogProps) {
  const [presets, setPresets] = useState<WorktreeCopyPreset[]>([])
  const [selectedPresetId, setSelectedPresetId] = useState<string>('')
  const [tree, setTree] = useState<IgnoredFileNode[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [treeLoaded, setTreeLoaded] = useState(false)

  // Load presets + file tree on open
  useEffect(() => {
    if (!open) return
    setExpanded(new Set())
    setTree([])
    setTreeLoaded(false)

    window.api.settings.get('worktree_copy_presets').then((raw) => {
      const parsed = raw ? JSON.parse(raw) as WorktreeCopyPreset[] : null
      const list = parsed && parsed.length > 0 ? parsed : DEFAULT_COPY_PRESETS
      setPresets(list)
      setSelectedPresetId(list[0].id)
    }).catch(() => {
      setPresets(DEFAULT_COPY_PRESETS)
      setSelectedPresetId(DEFAULT_COPY_PRESETS[0].id)
    })

    setLoading(true)
    window.api.git.getIgnoredFileTree(repoPath).then(nodes => {
      setTree(nodes)
      setTreeLoaded(true)
      setLoading(false)
    }).catch(() => {
      setTree([])
      setTreeLoaded(true)
      setLoading(false)
    })
  }, [open, repoPath])

  // Apply preset filter when preset or tree changes
  useEffect(() => {
    if (!treeLoaded || presets.length === 0) return
    const preset = presets.find(p => p.id === selectedPresetId)
    if (!preset) return
    setSelected(filterTreeByGlobs(tree, preset.pathGlobs))
  }, [selectedPresetId, treeLoaded, tree, presets])

  const toggle = useCallback((name: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
    // Switching to custom when user manually toggles
    setSelectedPresetId('custom')
  }, [])

  const toggleAll = () => {
    const allNames = flattenTree(tree)
    if (selected.size === allNames.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(allNames))
    }
    setSelectedPresetId('custom')
  }

  const toggleExpand = useCallback((path: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const handleConfirm = () => {
    if (selected.size === 0) {
      onConfirm({ mode: 'none' })
    } else {
      onConfirm({ mode: 'custom', paths: [...selected] })
    }
  }

  const handleSkip = () => {
    onConfirm({ mode: 'none' })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-lg flex flex-col">
        <DialogHeader className="space-y-1">
          <DialogTitle>Copy files to worktree</DialogTitle>
          <DialogDescription>
            Select which ignored files to include in the new worktree.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Preset selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Preset</label>
            <Select value={selectedPresetId} onValueChange={setSelectedPresetId}>
              <SelectTrigger className="h-8 text-xs w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {presets.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
                {selectedPresetId === 'custom' && (
                  <SelectItem value="custom">Custom</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* File tree */}
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 rounded-lg border bg-muted/20">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Scanning ignored files…</span>
            </div>
          ) : tree.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No ignored files found.</p>
          ) : (
            <div className="flex flex-col gap-2 min-h-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {selected.size} of {tree.length} selected
                </span>
                <button type="button" onClick={toggleAll} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  {selected.size === tree.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border p-2 max-h-[40vh]">
                {tree.map(node => (
                  <div key={node.name}>
                    <div className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted transition-colors">
                      <Checkbox
                        checked={selected.has(node.name)}
                        onCheckedChange={() => toggle(node.name)}
                      />
                      {node.isDirectory ? (
                        <button type="button" onClick={() => toggleExpand(node.path)} className="flex items-center gap-1.5 flex-1 min-w-0 text-left">
                          <ChevronRight className={cn('h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform', expanded.has(node.path) && 'rotate-90')} />
                          <Folder className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                          <span className="text-sm font-mono flex-1 truncate">{node.name}/</span>
                          <span className="text-xs text-muted-foreground shrink-0">{node.fileCount} file{node.fileCount !== 1 ? 's' : ''}</span>
                        </button>
                      ) : (
                        <span className="flex items-center gap-1.5 flex-1 min-w-0">
                          <span className="w-3.5" />
                          <File className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-sm font-mono flex-1 truncate">{node.name}</span>
                          {node.size > 0 && <span className="text-xs text-muted-foreground shrink-0">{formatBytes(node.size)}</span>}
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
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={handleSkip}>Skip</Button>
          <Button size="sm" onClick={handleConfirm} disabled={selected.size === 0}>
            Copy {selected.size} item{selected.size !== 1 ? 's' : ''}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
