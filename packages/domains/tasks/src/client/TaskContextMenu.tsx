import { useState } from 'react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  taskStatusOptions
} from '@slayzone/ui'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@slayzone/ui'
import type { Task, TaskStatus } from '@slayzone/task/shared'
import type { Project } from '@slayzone/projects/shared'

interface TaskContextMenuProps {
  task: Task
  projects: Project[]
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void
  onArchiveTask: (taskId: string) => void
  onDeleteTask: (taskId: string) => void
  children: React.ReactNode
}

const PRIORITY_LABELS: Record<number, string> = {
  1: 'Urgent',
  2: 'High',
  3: 'Medium',
  4: 'Low',
  5: 'Someday'
}

export function TaskContextMenu({
  task,
  projects,
  onUpdateTask,
  onArchiveTask,
  onDeleteTask,
  children
}: TaskContextMenuProps): React.JSX.Element {
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const handleStatusChange = (status: string): void => {
    onUpdateTask(task.id, { status: status as TaskStatus })
  }

  const handlePriorityChange = (priority: string): void => {
    onUpdateTask(task.id, { priority: parseInt(priority, 10) })
  }

  const handleProjectChange = (projectId: string): void => {
    onUpdateTask(task.id, { project_id: projectId })
  }

  const handleCopyTitle = async (): Promise<void> => {
    await navigator.clipboard.writeText(task.title)
  }

  const handleCopyLink = async (): Promise<void> => {
    await navigator.clipboard.writeText(`slayzone://task/${task.id}`)
  }

  const handleArchiveConfirm = (): void => {
    onArchiveTask(task.id)
    setArchiveDialogOpen(false)
  }

  const handleDeleteConfirm = (): void => {
    onDeleteTask(task.id)
    setDeleteDialogOpen(false)
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          {/* Status submenu */}
          <ContextMenuSub>
            <ContextMenuSubTrigger>Status</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuRadioGroup value={task.status} onValueChange={handleStatusChange}>
                {taskStatusOptions.map((s) => (
                  <ContextMenuRadioItem key={s.value} value={s.value}>
                    {s.label}
                  </ContextMenuRadioItem>
                ))}
              </ContextMenuRadioGroup>
            </ContextMenuSubContent>
          </ContextMenuSub>

          {/* Priority submenu */}
          <ContextMenuSub>
            <ContextMenuSubTrigger>Priority</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuRadioGroup
                value={String(task.priority)}
                onValueChange={handlePriorityChange}
              >
                {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                  <ContextMenuRadioItem key={value} value={value}>
                    {label}
                  </ContextMenuRadioItem>
                ))}
              </ContextMenuRadioGroup>
            </ContextMenuSubContent>
          </ContextMenuSub>

          <ContextMenuSeparator />

          {/* Move to project */}
          <ContextMenuSub>
            <ContextMenuSubTrigger>Move to</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuRadioGroup
                value={task.project_id}
                onValueChange={handleProjectChange}
              >
                {projects.map((p) => (
                  <ContextMenuRadioItem key={p.id} value={p.id}>
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-2"
                      style={{ backgroundColor: p.color }}
                    />
                    {p.name}
                  </ContextMenuRadioItem>
                ))}
              </ContextMenuRadioGroup>
            </ContextMenuSubContent>
          </ContextMenuSub>

          {/* Copy submenu */}
          <ContextMenuSub>
            <ContextMenuSubTrigger>Copy</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem onSelect={handleCopyTitle}>Title</ContextMenuItem>
              <ContextMenuItem onSelect={handleCopyLink}>Link</ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>

          <ContextMenuSeparator />

          {/* Archive */}
          <ContextMenuItem onSelect={() => setArchiveDialogOpen(true)}>Archive</ContextMenuItem>

          {/* Delete */}
          <ContextMenuItem variant="destructive" onSelect={() => setDeleteDialogOpen(true)}>
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Archive confirmation dialog */}
      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Task</AlertDialogTitle>
            <AlertDialogDescription>
              Archive "{task.title}"? You can restore it later from the archive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchiveConfirm}>Archive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Delete "{task.title}"? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
