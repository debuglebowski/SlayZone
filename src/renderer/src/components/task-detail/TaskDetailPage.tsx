import { useState, useEffect, useRef } from 'react'
import { ArrowLeft } from 'lucide-react'
import type { Task, Tag } from '../../../../shared/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TaskMetadataRow } from './TaskMetadataRow'
import { MarkdownEditor } from './MarkdownEditor'
import { SubtaskAccordion } from './SubtaskAccordion'

interface TaskDetailPageProps {
  taskId: string
  onBack: () => void
  onTaskUpdated: (task: Task) => void
}

export function TaskDetailPage({
  taskId,
  onBack,
  onTaskUpdated
}: TaskDetailPageProps): React.JSX.Element {
  const [task, setTask] = useState<Task | null>(null)
  const [tags, setTags] = useState<Tag[]>([])
  const [taskTagIds, setTaskTagIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  // Title editing state
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState('')
  const titleInputRef = useRef<HTMLInputElement>(null)

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
      titleInputRef.current.select()
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

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        Loading...
      </div>
    )
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
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background p-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="size-5" />
          </Button>

          {editingTitle ? (
            <Input
              ref={titleInputRef}
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={handleTitleKeyDown}
              className="text-2xl font-bold"
            />
          ) : (
            <h1
              onClick={() => setEditingTitle(true)}
              className="cursor-pointer text-2xl font-bold hover:text-muted-foreground"
            >
              {task.title}
            </h1>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-4xl p-6">
        {/* Metadata row */}
        <TaskMetadataRow
          task={task}
          tags={tags}
          taskTagIds={taskTagIds}
          onUpdate={handleTaskUpdate}
          onTagsChange={handleTagsChange}
        />

        {/* Description */}
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">
            Description
          </h2>
          <MarkdownEditor
            value={descriptionValue}
            onChange={setDescriptionValue}
            onSave={handleDescriptionSave}
            placeholder="Click to add description..."
          />
        </section>

        {/* Subtasks */}
        <section className="mt-8 border-t pt-6">
          <SubtaskAccordion
            parentTaskId={task.id}
            projectId={task.project_id}
          />
        </section>
      </main>
    </div>
  )
}
