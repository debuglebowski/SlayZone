import { useState, useEffect, useRef, useCallback } from 'react'
import { ArrowLeft, MoreHorizontal, Archive, Trash2, AlertTriangle } from 'lucide-react'
import type { Task, Tag, Project } from '../../../../shared/types/database'
import type { ClaudeAvailability } from '../../../../shared/types/api'
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
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { Terminal } from '@/components/terminal/Terminal'
import { cn } from '@/lib/utils'

interface TaskDetailPageProps {
  taskId: string
  onBack: () => void
  onTaskUpdated: (task: Task) => void
  onNavigateToTask?: (taskId: string) => void
}

export function TaskDetailPage({
  taskId,
  onBack,
  onTaskUpdated
}: TaskDetailPageProps): React.JSX.Element {
  const [task, setTask] = useState<Task | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [tags, setTags] = useState<Tag[]>([])
  const [taskTagIds, setTaskTagIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [claudeAvailability, setClaudeAvailability] = useState<ClaudeAvailability | null>(null)

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
      const [loadedTask, loadedTags, loadedTaskTags, projects, claudeCheck] = await Promise.all([
        window.api.db.getTask(taskId),
        window.api.tags.getTags(),
        window.api.taskTags.getTagsForTask(taskId),
        window.api.db.getProjects(),
        window.api.claude.checkAvailability()
      ])

      if (loadedTask) {
        setTask(loadedTask)
        setTitleValue(loadedTask.title)
        setDescriptionValue(loadedTask.description ?? '')
        // Find project for this task
        const taskProject = projects.find((p) => p.id === loadedTask.project_id)
        setProject(taskProject || null)
      }
      setTags(loadedTags)
      setTaskTagIds(loadedTaskTags.map((t) => t.id))
      setClaudeAvailability(claudeCheck)
      setLoading(false)
    }

    loadData()
  }, [taskId])

  // Handle session ID creation from terminal
  const handleSessionCreated = useCallback(
    async (sessionId: string) => {
      if (!task) return
      const updated = await window.api.db.updateTask({
        id: task.id,
        claudeSessionId: sessionId
      })
      setTask(updated)
      onTaskUpdated(updated)
    },
    [task, onTaskUpdated]
  )

  // Handle invalid session (e.g., "No conversation found" error)
  const handleSessionInvalid = useCallback(async () => {
    if (!task) return
    
    // Clear the stale session ID from the database
    const updated = await window.api.db.updateTask({
      id: task.id,
      claudeSessionId: null
    })
    setTask(updated)
    onTaskUpdated(updated)
    
    // Kill the current PTY so we can restart fresh
    await window.api.pty.kill(task.id)
  }, [task, onTaskUpdated])

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
      titleInputRef.current?.blur()
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
    <div className="h-screen flex flex-col">
      {/* Draggable region for window movement - clears traffic lights */}
      <div className="h-10 window-drag-region shrink-0" />

      {/* Header */}
      <header className="shrink-0 border-b bg-background">
        <div className="px-4 py-2">
          <div className="flex items-center gap-4 window-no-drag">
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
                'text-xl font-semibold bg-transparent border-none outline-none flex-1',
                !editingTitle && 'cursor-pointer'
              )}
            />

            <div className="flex items-center gap-2">
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

      {/* Split view: info left | terminal right */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Task info */}
        <div className="w-80 shrink-0 border-r flex flex-col overflow-y-auto">
          {/* Description */}
          <div className="p-4 flex-1">
            <RichTextEditor
              value={descriptionValue}
              onChange={setDescriptionValue}
              onBlur={handleDescriptionSave}
              placeholder="Add description..."
              minHeight="150px"
              className="bg-muted/30 rounded-lg p-3"
            />
          </div>

          {/* Metadata */}
          <div className="p-4 border-t bg-muted/30">
            <TaskMetadataSidebar
              task={task}
              tags={tags}
              taskTagIds={taskTagIds}
              onUpdate={handleTaskUpdate}
              onTagsChange={handleTagsChange}
            />
          </div>
        </div>

        {/* Right: Terminal */}
        <div className="flex-1 min-w-0 bg-[#0a0a0a] flex flex-col">
          {claudeAvailability && !claudeAvailability.available && (
            <div className="shrink-0 bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center gap-2 text-amber-500">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">
                Claude Code CLI not found. Install it to use AI features.
              </span>
            </div>
          )}
          <div className="flex-1 min-h-0">
            {project?.path ? (
              <Terminal
                taskId={task.id}
                cwd={project.path}
                sessionId={task.claude_session_id || undefined}
                existingSessionId={task.claude_session_id || undefined}
                onSessionCreated={handleSessionCreated}
                onSessionInvalid={handleSessionInvalid}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center p-8">
                  <p className="mb-2">No repository path configured</p>
                  <p className="text-sm">
                    Set a repository path in project settings to use the terminal
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <DeleteTaskDialog
        task={task}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onDeleted={handleDeleteConfirm}
      />
    </div>
  )
}
