import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Dialog,
  DialogContent,
  cn
} from '@slayzone/ui'
import { CheckSquare, Folder } from 'lucide-react'
import { FileIcon } from '@slayzone/icons'
import { track } from '@slayzone/telemetry/client'
import { useDialogStore } from '@slayzone/settings'
import type { Task } from '@slayzone/task/shared'
import type { Project } from '@slayzone/projects/shared'

const MAX_FILES = 100

type FilterKind = 'all' | 'files' | 'tasks' | 'projects'
const FILTERS: { id: FilterKind; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'files', label: 'Files' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'projects', label: 'Projects' }
]

interface SearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tasks: Task[]
  projects: Project[]
  onSelectTask: (taskId: string) => void
  onSelectProject: (projectId: string) => void
}

function fuzzyMatch(query: string, target: string): boolean {
  if (!query) return true
  const lower = target.toLowerCase()
  const q = query.toLowerCase()
  let qi = 0
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) qi++
  }
  return qi === q.length
}

export function SearchDialog({
  open,
  onOpenChange,
  tasks,
  projects,
  onSelectTask,
  onSelectProject
}: SearchDialogProps) {
  const fileContext = useDialogStore((s) => s.searchFileContext)
  const [allFiles, setAllFiles] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterKind>('all')
  const cacheRef = useRef<{ path: string; files: string[] } | null>(null)

  useEffect(() => {
    if (!open || !fileContext) {
      setAllFiles([])
      return
    }
    const path = fileContext.projectPath
    if (cacheRef.current?.path === path) {
      setAllFiles(cacheRef.current.files)
      return
    }
    window.api.fs.listAllFiles(path).then((list) => {
      cacheRef.current = { path, files: list }
      setAllFiles(list)
    })
  }, [open, fileContext])

  useEffect(() => {
    if (open) {
      setSearch('')
      setFilter('all')
    }
  }, [open])

  const filteredFiles = useMemo(() => {
    if (!search || !fileContext) return []
    const matches: string[] = []
    for (const f of allFiles) {
      if (fuzzyMatch(search, f)) {
        matches.push(f)
        if (matches.length >= MAX_FILES) break
      }
    }
    return matches
  }, [allFiles, search, fileContext])

  const filteredTasks = useMemo(() => {
    if (!search) return []
    return tasks.filter((task) => {
      const projectName = projects.find((p) => p.id === task.project_id)?.name ?? ''
      return fuzzyMatch(search, task.title) || fuzzyMatch(search, projectName)
    })
  }, [tasks, projects, search])

  const filteredProjects = useMemo(() => {
    if (!search) return []
    return projects.filter((p) => fuzzyMatch(search, p.name))
  }, [projects, search])

  const showFiles = filter === 'all' || filter === 'files'
  const showTasks = filter === 'all' || filter === 'tasks'
  const showProjects = filter === 'all' || filter === 'projects'

  const visibleCount =
    (showFiles ? filteredFiles.length : 0) +
    (showTasks ? filteredTasks.length : 0) +
    (showProjects ? filteredProjects.length : 0)

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return
    e.preventDefault()
    const idx = FILTERS.findIndex((f) => f.id === filter)
    const delta = e.shiftKey ? -1 : 1
    const next = FILTERS[(idx + delta + FILTERS.length) % FILTERS.length]
    setFilter(next.id)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0" showCloseButton={false}>
        <Command
          shouldFilter={false}
          onKeyDown={handleKeyDown}
          className="[&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
        >
          <CommandInput
            placeholder="Search files, tasks, projects..."
            value={search}
            onValueChange={setSearch}
          />
          <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setFilter(f.id)}
                className={cn(
                  'rounded px-2 py-1 text-xs transition-colors',
                  filter === f.id
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
                )}
              >
                {f.label}
              </button>
            ))}
            <span className="ml-auto text-[10px] text-muted-foreground/70">Tab to switch</span>
          </div>
          <CommandList>
            {search && visibleCount === 0 && <CommandEmpty>No results found.</CommandEmpty>}

            {showFiles && filteredFiles.length > 0 && (
              <CommandGroup heading="Files">
                {filteredFiles.map((filePath) => {
                  const name = filePath.split('/').pop() ?? filePath
                  const dir = filePath.includes('/') ? filePath.slice(0, filePath.lastIndexOf('/')) : ''
                  return (
                    <CommandItem
                      key={filePath}
                      value={filePath}
                      onSelect={() => {
                        track('quick_open_used')
                        fileContext?.openFile(filePath)
                        onOpenChange(false)
                      }}
                    >
                      <FileIcon fileName={name} className="size-4 shrink-0 flex items-center [&>svg]:size-full" />
                      <span className="truncate font-mono text-xs">{name}</span>
                      {dir && (
                        <span className="ml-auto text-[11px] text-muted-foreground truncate max-w-[200px]">{dir}</span>
                      )}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            )}

            {showTasks && filteredTasks.length > 0 && (
              <CommandGroup heading="Tasks">
                {filteredTasks.map((task) => (
                  <CommandItem
                    key={task.id}
                    value={`task:${task.id}`}
                    onSelect={() => {
                      onSelectTask(task.id)
                      onOpenChange(false)
                    }}
                  >
                    <CheckSquare className="mr-2 h-4 w-4" />
                    <span>{task.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {showProjects && filteredProjects.length > 0 && (
              <CommandGroup heading="Projects">
                {filteredProjects.map((project) => (
                  <CommandItem
                    key={project.id}
                    value={`project:${project.id}`}
                    onSelect={() => {
                      onSelectProject(project.id)
                      onOpenChange(false)
                    }}
                  >
                    <Folder className="mr-2 h-4 w-4" />
                    <span>{project.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
