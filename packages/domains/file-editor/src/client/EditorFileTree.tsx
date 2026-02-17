import { useState, useCallback, useEffect, useRef } from 'react'
import {
  FilePlus,
  FolderPlus,
  Folder,
  FolderOpen,
  Pencil,
  Trash2
} from 'lucide-react'
import {
  cn,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  Input
} from '@slayzone/ui'
import type { DirEntry } from '../shared'
import { FileIcon } from './FileIcon'

const INDENT_PX = 20
const BASE_PAD = 12

interface EditorFileTreeProps {
  projectPath: string
  onOpenFile: (path: string) => void
  activeFilePath: string | null
  /** Increment to trigger reload of expanded directories */
  refreshKey?: number
  /** Controlled expanded folders (optional — uses internal state if not provided) */
  expandedFolders?: Set<string>
  onExpandedFoldersChange?: (folders: Set<string>) => void
}

export function EditorFileTree({ projectPath, onOpenFile, activeFilePath, refreshKey, expandedFolders: controlledExpanded, onExpandedFoldersChange }: EditorFileTreeProps) {
  // Map of dirPath -> children entries (lazy loaded)
  const [dirContents, setDirContents] = useState<Map<string, DirEntry[]>>(new Map())
  const [internalExpanded, setInternalExpanded] = useState<Set<string>>(new Set())
  const expandedFolders = controlledExpanded ?? internalExpanded
  const setExpandedFolders = useCallback((updater: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    const update = (prev: Set<string>) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      onExpandedFoldersChange?.(next)
      return next
    }
    if (controlledExpanded) {
      // Controlled mode — compute and emit, parent owns state
      update(controlledExpanded)
    } else {
      setInternalExpanded(update)
    }
  }, [controlledExpanded, onExpandedFoldersChange])
  const [creating, setCreating] = useState<{ parentPath: string; type: 'file' | 'directory' } | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const createInputRef = useRef<HTMLInputElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  const loadDir = useCallback(
    async (dirPath: string) => {
      const items = await window.api.fs.readDir(projectPath, dirPath)
      setDirContents((prev) => {
        const next = new Map(prev)
        next.set(dirPath, items)
        return next
      })
    },
    [projectPath]
  )

  // Load root on mount
  useEffect(() => {
    loadDir('')
  }, [loadDir])

  // Reload expanded dirs on external file changes
  useEffect(() => {
    if (!refreshKey) return
    loadDir('')
    expandedFolders.forEach((dir) => loadDir(dir))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  const handleToggleFolder = useCallback(
    (folderPath: string) => {
      setExpandedFolders((prev) => {
        const next = new Set(prev)
        if (next.has(folderPath)) {
          next.delete(folderPath)
        } else {
          next.add(folderPath)
          if (!dirContents.has(folderPath)) {
            loadDir(folderPath)
          }
        }
        return next
      })
    },
    [loadDir, dirContents]
  )

  const handleCreate = useCallback(
    async (name: string) => {
      if (!creating || !name.trim()) {
        setCreating(null)
        return
      }
      const newPath = creating.parentPath ? `${creating.parentPath}/${name.trim()}` : name.trim()
      try {
        if (creating.type === 'file') {
          await window.api.fs.createFile(projectPath, newPath)
        } else {
          await window.api.fs.createDir(projectPath, newPath)
        }
        await loadDir(creating.parentPath)
        if (creating.type === 'file') {
          onOpenFile(newPath)
        }
      } catch (err) {
        console.error('Create failed:', err)
      }
      setCreating(null)
    },
    [creating, projectPath, loadDir, onOpenFile]
  )

  const handleRename = useCallback(
    async (oldPath: string, newName: string) => {
      if (!newName.trim() || !renaming) {
        setRenaming(null)
        return
      }
      const parentDir = oldPath.includes('/') ? oldPath.slice(0, oldPath.lastIndexOf('/')) : ''
      const newPath = parentDir ? `${parentDir}/${newName.trim()}` : newName.trim()
      try {
        await window.api.fs.rename(projectPath, oldPath, newPath)
        await loadDir(parentDir)
      } catch (err) {
        console.error('Rename failed:', err)
      }
      setRenaming(null)
    },
    [renaming, projectPath, loadDir]
  )

  const handleDelete = useCallback(
    async (entry: DirEntry) => {
      try {
        await window.api.fs.delete(projectPath, entry.path)
        const parentDir = entry.path.includes('/') ? entry.path.slice(0, entry.path.lastIndexOf('/')) : ''
        await loadDir(parentDir)
      } catch (err) {
        console.error('Delete failed:', err)
      }
    },
    [projectPath, loadDir]
  )

  const startCreate = useCallback((parentPath: string, type: 'file' | 'directory') => {
    setCreating({ parentPath, type })
    if (parentPath) {
      setExpandedFolders((prev) => new Set([...prev, parentPath]))
      if (!dirContents.has(parentPath)) loadDir(parentPath)
    }
  }, [dirContents, loadDir])

  const startRename = useCallback((entry: DirEntry) => {
    setRenaming(entry.path)
    setRenameValue(entry.name)
  }, [])

  useEffect(() => {
    if (creating) createInputRef.current?.focus()
  }, [creating])
  useEffect(() => {
    if (renaming) renameInputRef.current?.focus()
  }, [renaming])

  const renderEntry = (entry: DirEntry, depth: number) => {
    if (entry.ignored) return null
    const pad = depth * INDENT_PX + BASE_PAD

    if (entry.type === 'directory') {
      const expanded = expandedFolders.has(entry.path)
      const children = dirContents.get(entry.path) ?? []
      return (
        <div key={`d:${entry.path}`}>
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <button
                className={cn(
                  'group/folder flex w-full select-none items-center gap-1.5 rounded px-1 py-1 text-xs hover:bg-muted/50'
                )}
                style={{ paddingLeft: pad }}
                onClick={() => handleToggleFolder(entry.path)}
              >
                {expanded
                  ? <FolderOpen className="size-4 shrink-0 text-amber-400" />
                  : <Folder className="size-4 shrink-0 text-amber-500/80" />}
                <span className="truncate font-mono">{entry.name}</span>
              </button>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onSelect={() => startCreate(entry.path, 'file')}>
                <FilePlus className="size-3 mr-2" /> New file
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => startCreate(entry.path, 'directory')}>
                <FolderPlus className="size-3 mr-2" /> New folder
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onSelect={() => startRename(entry)}>
                <Pencil className="size-3 mr-2" /> Rename
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem variant="destructive" onSelect={() => handleDelete(entry)}>
                <Trash2 className="size-3 mr-2" /> Delete
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>

          {expanded && children.map((child) => renderEntry(child, depth + 1))}

          {/* Inline create input inside this folder */}
          {creating && creating.parentPath === entry.path && (
            <div style={{ paddingLeft: (depth + 1) * INDENT_PX + BASE_PAD }} className="py-0.5">
              <Input
                ref={createInputRef}
                placeholder={creating.type === 'file' ? 'filename' : 'folder name'}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate((e.target as HTMLInputElement).value)
                  if (e.key === 'Escape') setCreating(null)
                }}
                onBlur={(e) => handleCreate(e.target.value)}
                className="h-6 text-xs font-mono py-0 px-1"
              />
            </div>
          )}
        </div>
      )
    }

    // File entry
    if (renaming === entry.path) {
      return (
        <div key={`f:${entry.path}`} style={{ paddingLeft: pad }}>
          <Input
            ref={renameInputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename(entry.path, renameValue)
              if (e.key === 'Escape') setRenaming(null)
            }}
            onBlur={() => handleRename(entry.path, renameValue)}
            className="h-6 text-xs font-mono py-0 px-1"
          />
        </div>
      )
    }

    return (
      <ContextMenu key={`f:${entry.path}`}>
        <ContextMenuTrigger asChild>
          <button
            className={cn(
              'flex w-full items-center gap-1.5 rounded px-1 py-1 text-xs hover:bg-muted/50',
              entry.path === activeFilePath && 'bg-muted text-foreground'
            )}
            style={{ paddingLeft: pad }}
            onClick={() => onOpenFile(entry.path)}
          >
            <FileIcon fileName={entry.name} className="size-4 shrink-0 flex items-center [&>svg]:size-full" />
            <span className="truncate font-mono">{entry.name}</span>
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={() => startRename(entry)}>
            <Pencil className="size-3 mr-2" /> Rename
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive" onSelect={() => handleDelete(entry)}>
            <Trash2 className="size-3 mr-2" /> Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    )
  }

  const rootEntries = dirContents.get('') ?? []

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-10 border-b shrink-0">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Files</span>
        <div className="flex items-center gap-1">
          <button
            className="size-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground"
            onClick={() => startCreate('', 'file')}
            title="New file"
          >
            <FilePlus className="size-3.5" />
          </button>
          <button
            className="size-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground"
            onClick={() => startCreate('', 'directory')}
            title="New folder"
          >
            <FolderPlus className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-auto py-1 select-none text-sm">
        {rootEntries.map((entry) => renderEntry(entry, 0))}

        {/* Root-level create input */}
        {creating && creating.parentPath === '' && (
          <div className="px-2 py-0.5">
            <Input
              ref={createInputRef}
              placeholder={creating.type === 'file' ? 'filename' : 'folder name'}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate((e.target as HTMLInputElement).value)
                if (e.key === 'Escape') setCreating(null)
              }}
              onBlur={(e) => handleCreate(e.target.value)}
              className="h-6 text-xs font-mono py-0 px-1"
            />
          </div>
        )}
      </div>
    </div>
  )
}
