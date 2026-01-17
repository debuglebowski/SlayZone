import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'
import { Folder, CheckSquare } from 'lucide-react'
import type { Task, Project } from '../../../../shared/types/database'

interface SearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tasks: Task[]
  projects: Project[]
  onSelectTask: (taskId: string) => void
  onSelectProject: (projectId: string) => void
}

export function SearchDialog({
  open,
  onOpenChange,
  tasks,
  projects,
  onSelectTask,
  onSelectProject
}: SearchDialogProps) {
  // Filter to top-level tasks only (no subtasks)
  const searchableTasks = tasks.filter((t) => !t.parent_id)

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search tasks and projects..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {projects.length > 0 && (
          <CommandGroup heading="Projects">
            {projects.map((project) => (
              <CommandItem
                key={project.id}
                value={project.name}
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

        {searchableTasks.length > 0 && (
          <CommandGroup heading="Tasks">
            {searchableTasks.map((task) => (
              <CommandItem
                key={task.id}
                value={task.title}
                keywords={[
                  // Include project name in search
                  projects.find((p) => p.id === task.project_id)?.name ?? ''
                ].filter(Boolean)}
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
      </CommandList>
    </CommandDialog>
  )
}
