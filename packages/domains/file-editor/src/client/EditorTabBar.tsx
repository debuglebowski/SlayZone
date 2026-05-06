import { X, PanelLeftClose, PanelLeft } from 'lucide-react'
import {
  cn,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@slayzone/ui'
import type { OpenFile } from './useFileEditor'
import { FileIcon } from './FileIcon'

interface EditorTabBarProps {
  files: OpenFile[]
  activeFilePath: string | null
  onSelect: (path: string) => void
  onClose: (path: string) => void
  onCloseOthers: (path: string) => void
  onCloseToRight: (path: string) => void
  onCloseSaved: () => void
  onCloseAll: () => void
  onCopyPath: (path: string) => void
  onCopyRelativePath: (path: string) => void
  onRevealInFinder: (path: string) => void
  isDirty: (path: string) => boolean
  diskChanged?: (path: string) => boolean
  deleted?: (path: string) => boolean
  treeVisible?: boolean
  onToggleTree?: () => void
}

function fileName(path: string): string {
  return path.split('/').pop() ?? path
}

export function EditorTabBar({
  files,
  activeFilePath,
  onSelect,
  onClose,
  onCloseOthers,
  onCloseToRight,
  onCloseSaved,
  onCloseAll,
  onCopyPath,
  onCopyRelativePath,
  onRevealInFinder,
  isDirty,
  diskChanged,
  deleted,
  treeVisible,
  onToggleTree
}: EditorTabBarProps) {
  return (
    <div className="flex items-center h-10 px-2 gap-1 flex-1 min-w-0">
      {onToggleTree && (
        <button
          className="flex items-center justify-center size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
          onClick={onToggleTree}
          title={treeVisible ? 'Hide file tree' : 'Show file tree'}
        >
          {treeVisible ? <PanelLeftClose className="size-4" /> : <PanelLeft className="size-4" />}
        </button>
      )}
      <div className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0 scrollbar-hide">
      {files.map((file, idx) => {
        const active = file.path === activeFilePath
        const dirty = isDirty(file.path)
        const name = fileName(file.path)
        const isLast = idx === files.length - 1
        const onlyTab = files.length === 1
        return (
          <ContextMenu key={file.path}>
            <ContextMenuTrigger asChild>
              <button
                className={cn(
                  'group flex items-center gap-1.5 px-3 h-7 text-xs rounded-md shrink-0 transition-colors',
                  'bg-surface-2 dark:bg-surface-2/50 hover:bg-accent/80 dark:hover:bg-accent/50',
                  active
                    ? 'bg-tab-active border border-border text-foreground'
                    : 'text-muted-foreground dark:text-muted-foreground'
                )}
                onClick={() => onSelect(file.path)}
                onAuxClick={(e) => {
                  if (e.button === 1) onClose(file.path)
                }}
                title={file.path}
              >
                <FileIcon fileName={name} className="size-4 shrink-0 flex items-center [&>svg]:size-full" />
                <span className="truncate max-w-[160px] font-mono">
                  {name}
                </span>
                {deleted?.(file.path) ? (
                  <span className="text-[10px] leading-none text-destructive shrink-0">deleted</span>
                ) : diskChanged?.(file.path) && (
                  <span className="text-[10px] leading-none text-amber-500 shrink-0">changed</span>
                )}
                <span
                  className="grid place-items-center size-4 shrink-0 rounded hover:bg-muted"
                  onClick={(e) => {
                    e.stopPropagation()
                    onClose(file.path)
                  }}
                >
                  {dirty && (
                    <span className="col-start-1 row-start-1 size-2 rounded-full bg-foreground opacity-40 transition-opacity group-hover:opacity-0" />
                  )}
                  <X className="col-start-1 row-start-1 size-3 opacity-0 transition-opacity group-hover:opacity-100" />
                </span>
              </button>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onSelect={() => onClose(file.path)}>Close</ContextMenuItem>
              <ContextMenuItem
                disabled={onlyTab}
                onSelect={() => onCloseOthers(file.path)}
              >
                Close Others
              </ContextMenuItem>
              <ContextMenuItem
                disabled={isLast}
                onSelect={() => onCloseToRight(file.path)}
              >
                Close to the Right
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => onCloseSaved()}>Close Saved</ContextMenuItem>
              <ContextMenuItem onSelect={() => onCloseAll()}>Close All</ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onSelect={() => onCopyPath(file.path)}>Copy Path</ContextMenuItem>
              <ContextMenuItem onSelect={() => onCopyRelativePath(file.path)}>
                Copy Relative Path
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => onRevealInFinder(file.path)}>
                Reveal in Finder
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        )
      })}
      </div>
    </div>
  )
}
