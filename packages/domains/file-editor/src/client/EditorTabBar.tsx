import { X } from 'lucide-react'
import { cn } from '@slayzone/ui'
import type { OpenFile } from './useFileEditor'
import { FileIcon } from './FileIcon'

interface EditorTabBarProps {
  files: OpenFile[]
  activeFilePath: string | null
  onSelect: (path: string) => void
  onClose: (path: string) => void
  isDirty: (path: string) => boolean
  diskChanged?: (path: string) => boolean
}

function fileName(path: string): string {
  return path.split('/').pop() ?? path
}

export function EditorTabBar({ files, activeFilePath, onSelect, onClose, isDirty, diskChanged }: EditorTabBarProps) {
  if (files.length === 0) return null

  return (
    <div className="flex items-center h-10 px-2 gap-1 border-b bg-surface-1 overflow-x-auto shrink-0">
      {files.map((file) => {
        const active = file.path === activeFilePath
        const dirty = isDirty(file.path)
        const name = fileName(file.path)
        return (
          <button
            key={file.path}
            className={cn(
              'group flex items-center gap-1.5 px-3 h-7 text-xs rounded-md shrink-0 transition-colors',
              'bg-neutral-100 dark:bg-neutral-800/50 hover:bg-neutral-200/80 dark:hover:bg-neutral-700/50',
              active
                ? 'bg-neutral-200 dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 text-foreground'
                : 'text-neutral-500 dark:text-neutral-400'
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
            {dirty && (
              <span className="size-1.5 rounded-full bg-foreground shrink-0" />
            )}
            {diskChanged?.(file.path) && (
              <span className="text-[10px] leading-none text-amber-500 shrink-0">changed</span>
            )}
            <span
              className="size-4 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-muted shrink-0"
              onClick={(e) => {
                e.stopPropagation()
                onClose(file.path)
              }}
            >
              <X className="size-3" />
            </span>
          </button>
        )
      })}
    </div>
  )
}
