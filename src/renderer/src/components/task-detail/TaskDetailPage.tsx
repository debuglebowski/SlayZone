import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, MoreHorizontal, Archive, Trash2 } from 'lucide-react'
import type { Task, Tag } from '../../../../shared/types/database'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { DeleteTaskDialog } from '@/components/DeleteTaskDialog'
import { TaskMetadataSidebar } from './TaskMetadataSidebar'
import { SubtaskAccordion } from './SubtaskAccordion'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface TaskDetailPageProps {
  taskId: string
  onBack: () => void
  onTaskUpdated: (task: Task) => void
  onWorkMode?: () => void
  onNavigateToTask?: (taskId: string) => void
}

export function TaskDetailPage({
  taskId,
  onBack,
  onTaskUpdated,
  onWorkMode,
  onNavigateToTask
}: TaskDetailPageProps): React.JSX.Element {
  const [task, setTask] = useState<Task | null>(null)
  const [tags, setTags] = useState<Tag[]>([])
  const [taskTagIds, setTaskTagIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  // Title editing state
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState('')
  const titleInputRef = useRef<HTMLInputElement>(null)

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // Description editing state
  const [descriptionValue, setDescriptionValue] = useState('')

  // Load task data on mount
  useEffect(() => {
    const loadData = async (): Promise<void> => {
      const [loadedTask, loadedTags, loadedTaskTags] = await Promise.all([
        window.api.db.getTask(taskId),
        window.api.tags.getTags(),
        window.api.taskTags.getTagsForTask(taskId)
      ])

      if (loadedTask) {
        setTask(loadedTask)
        setTitleValue(loadedTask.title)
        setDescriptionValue(loadedTask.description ?? '')
      }
      setTags(loadedTags)
      setTaskTagIds(loadedTaskTags.map((t) => t.id))
      setLoading(false)
    }

    loadData()
  }, [taskId])

  // Focus title input when editing
  useEffect(() => {
    if (editingTitle && titleInputRef.current) {
      titleInputRef.current.focus()
    }
  }, [editingTitle])

  const handleTitleSave = async (): Promise<void> => {
    if (!task || titleValue === task.title) {
      setEditingTitle(false)
      return
    }

    const updated = await window.api.db.updateTask({
      id: task.id,
      title: titleValue
    })
    setTask(updated)
    onTaskUpdated(updated)
    setEditingTitle(false)
  }

  const handleTitleKeyDown = async (e: React.KeyboardEvent): Promise<void> => {
    if (e.key === 'Enter') {
      await handleTitleSave()
    } else if (e.key === 'Escape') {
      setTitleValue(task?.title ?? '')
      setEditingTitle(false)
    }
  }

  const handleDescriptionSave = async (): Promise<void> => {
    if (!task) return

    const updated = await window.api.db.updateTask({
      id: task.id,
      description: descriptionValue || undefined
    })
    setTask(updated)
    onTaskUpdated(updated)
  }

  const handleTaskUpdate = (updated: Task): void => {
    setTask(updated)
    onTaskUpdated(updated)
  }

  const handleTagsChange = (newTagIds: string[]): void => {
    setTaskTagIds(newTagIds)
  }

  const handleArchive = async (): Promise<void> => {
    if (!task) return
    await window.api.db.archiveTask(task.id)
    onBack()
  }

  const handleDeleteConfirm = (): void => {
    setDeleteDialogOpen(false)
    onBack()
  }

  if (loading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>
  }

  if (!task) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Task not found</p>
          <Button variant="link" onClick={onBack}>
            Go back
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">
      {/* Left: centered content column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-background">
          <div className="mx-auto max-w-3xl p-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={onBack}>
                <ArrowLeft className="size-5" />
              </Button>

              <input
                ref={titleInputRef}
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={handleTitleKeyDown}
                onClick={() => setEditingTitle(true)}
                readOnly={!editingTitle}
                className={cn(
                  'text-2xl font-bold bg-transparent border-none outline-none w-full',
                  !editingTitle && 'cursor-pointer'
                )}
              />

              <div className="ml-auto flex items-center gap-2">
                {onWorkMode && (
                  <Button variant="outline" size="sm" onClick={onWorkMode}>
                    Work Mode
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="size-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleArchive}>
                      <Archive className="mr-2 size-4" />
                      Archive
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setDeleteDialogOpen(true)}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 size-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="mx-auto max-w-3xl w-full p-6">
          {/* Description */}
          <section>
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">Description</h2>
            <Textarea
              value={descriptionValue}
              onChange={(e) => setDescriptionValue(e.target.value)}
              onBlur={handleDescriptionSave}
              onKeyDown={async (e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  await handleDescriptionSave()
                }
              }}
              placeholder="Add description..."
              className="min-h-[200px]"
            />
          </section>

          {/* Subtasks */}
          <section className="mt-8">
            <SubtaskAccordion
              parentTaskId={task.id}
              projectId={task.project_id}
              onNavigate={onNavigateToTask || (() => {})}
            />
          </section>
        </main>
      </div>

      {/* Right: sidebar at window edge */}
      <aside className="w-64 shrink-0 border-l bg-muted/30 sticky top-0 h-screen overflow-y-auto">
        <div className="p-6">
          <TaskMetadataSidebar
            task={task}
            tags={tags}
            taskTagIds={taskTagIds}
            onUpdate={handleTaskUpdate}
            onTagsChange={handleTagsChange}
          />
        </div>
      </aside>

      <DeleteTaskDialog
        task={task}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onDeleted={handleDeleteConfirm}
      />
    </div>
  )
}
