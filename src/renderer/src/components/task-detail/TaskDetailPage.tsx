import { useState, useEffect, useRef, useCallback } from 'react'
import { MoreHorizontal, Archive, Trash2, AlertTriangle, RotateCw, RefreshCcw, Link2, Sparkles, Loader2 } from 'lucide-react'
import type { Task, Tag, Project, TerminalMode } from '../../../../shared/types/database'
import type { ClaudeAvailability } from '../../../../shared/types/api'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { DeleteTaskDialog } from '@/components/DeleteTaskDialog'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { TaskMetadataSidebar } from './TaskMetadataSidebar'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { Terminal } from '@/components/terminal/Terminal'
import { markSkipCache } from '@/components/terminal/terminal-cache'
import { usePty } from '@/contexts/PtyContext'
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

  // PTY context for buffer management
  const { resetTaskState, subscribeSessionDetected, getQuickRunPrompt, clearQuickRunPrompt } = usePty()

  // Detected session ID from /status command
  const [detectedSessionId, setDetectedSessionId] = useState<string | null>(null)

  // Title editing state
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState('')
  const titleInputRef = useRef<HTMLInputElement>(null)

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // Description editing state
  const [descriptionValue, setDescriptionValue] = useState('')
  const [generatingDescription, setGeneratingDescription] = useState(false)

  // Terminal restart key (changing this forces remount)
  const [terminalKey, setTerminalKey] = useState(0)

  // Terminal input function (exposed via onReady callback)
  const sendInputRef = useRef<((text: string) => Promise<void>) | null>(null)

  // Subscribe to session detected events
  useEffect(() => {
    if (!task) return
    return subscribeSessionDetected(task.id, setDetectedSessionId)
  }, [task?.id, subscribeSessionDetected])

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
        claudeConversationId: sessionId
      })
      setTask(updated)
      onTaskUpdated(updated)
    },
    [task, onTaskUpdated]
  )

  // Update DB with detected session ID
  const handleUpdateSessionId = useCallback(async () => {
    if (!task || !detectedSessionId) return
    const updated = await window.api.db.updateTask({
      id: task.id,
      claudeConversationId: detectedSessionId
    })
    setTask(updated)
    onTaskUpdated(updated)
    setDetectedSessionId(null)
  }, [task, detectedSessionId, onTaskUpdated])

  // Handle invalid session (e.g., "No conversation found" error)
  const handleSessionInvalid = useCallback(async () => {
    if (!task) return

    // Clear the stale session ID from the database
    const updated = await window.api.db.updateTask({
      id: task.id,
      claudeConversationId: null
    })
    setTask(updated)
    onTaskUpdated(updated)

    // Kill the current PTY so we can restart fresh
    await window.api.pty.kill(task.id)
  }, [task, onTaskUpdated])

  // Restart terminal (kill PTY, remount, keep session for --resume)
  const handleRestartTerminal = useCallback(async () => {
    if (!task) return
    resetTaskState(task.id)
    await window.api.pty.kill(task.id)
    await new Promise((r) => setTimeout(r, 100))
    markSkipCache(task.id)
    setTerminalKey((k) => k + 1)
  }, [task, resetTaskState])

  // Reset terminal (kill PTY, clear session ID, remount fresh)
  const handleResetTerminal = useCallback(async () => {
    if (!task) return
    resetTaskState(task.id)
    await window.api.pty.kill(task.id)
    // Clear session ID so new session starts fresh
    const updated = await window.api.db.updateTask({
      id: task.id,
      claudeConversationId: null
    })
    setTask(updated)
    onTaskUpdated(updated)
    await new Promise((r) => setTimeout(r, 100))
    markSkipCache(task.id)
    setTerminalKey((k) => k + 1)
  }, [task, resetTaskState, onTaskUpdated])

  // Re-attach terminal (remount without killing PTY - reuses cached terminal)
  const handleReattachTerminal = useCallback(() => {
    if (!task) return
    setTerminalKey((k) => k + 1)
  }, [task])

  // Sync Claude session name with task title
  const handleSyncSessionName = useCallback(async () => {
    if (!task || !sendInputRef.current) return
    await sendInputRef.current(`/rename ${task.title}\r`)
  }, [task])

  // Inject task title into terminal (no execute)
  const handleInjectTitle = useCallback(async () => {
    if (!task || !sendInputRef.current) return
    await sendInputRef.current(task.title)
  }, [task])

  // Cmd+I shortcut for inject title
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.metaKey && e.key === 'i') {
        e.preventDefault()
        handleInjectTitle()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleInjectTitle])

  // Clear quick run prompt after it's been passed to Terminal
  useEffect(() => {
    if (!task) return
    // Small delay to ensure Terminal has read the prompt
    const timer = setTimeout(() => {
      clearQuickRunPrompt(task.id)
    }, 500)
    return () => clearTimeout(timer)
  }, [task?.id, clearQuickRunPrompt])


  // Handle terminal mode change
  const handleModeChange = useCallback(
    async (mode: TerminalMode) => {
      if (!task) return
      // Reset state FIRST to ignore any in-flight data
      resetTaskState(task.id)
      // Now kill the PTY (any data it sends will be ignored)
      await window.api.pty.kill(task.id)
      // Small delay to let any remaining PTY data be processed and ignored
      await new Promise((r) => setTimeout(r, 100))
      // Update mode and clear all conversation IDs (fresh start)
      const updated = await window.api.db.updateTask({
        id: task.id,
        terminalMode: mode,
        claudeConversationId: null,
        codexConversationId: null,
        claudeSessionId: null
      })
      setTask(updated)
      onTaskUpdated(updated)
      // Remount terminal (mark skip to prevent cleanup from re-caching old content)
      markSkipCache(task.id)
      setTerminalKey((k) => k + 1)
    },
    [task, onTaskUpdated, resetTaskState]
  )

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

  const handleGenerateDescription = async (): Promise<void> => {
    if (!task || generatingDescription) return
    console.log('[generate] Starting for title:', task.title)
    setGeneratingDescription(true)
    try {
      const result = await window.api.ai.generateDescription(
        task.title,
        task.terminal_mode || 'claude-code'
      )
      console.log('[generate] Result:', result)
      if (result.success && result.description) {
        setDescriptionValue(result.description)
        const updated = await window.api.db.updateTask({
          id: task.id,
          description: result.description
        })
        setTask(updated)
        onTaskUpdated(updated)
      } else if (result.error) {
        console.error('[generate] Error:', result.error)
      }
    } catch (err) {
      console.error('[generate] Exception:', err)
    } finally {
      setGeneratingDescription(false)
    }
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
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="shrink-0 border-b bg-background">
        <div className="px-4 py-2">
          <div className="flex items-center gap-4 window-no-drag">
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
              {project?.path && (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleReattachTerminal}
                      >
                        <Link2 className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Re-attach terminal</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleRestartTerminal}
                      >
                        <RotateCw className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Restart terminal</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleResetTerminal}
                      >
                        <RefreshCcw className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Reset terminal</TooltipContent>
                  </Tooltip>
                </>
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
            {task.terminal_mode !== 'terminal' && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => handleGenerateDescription()}
                disabled={generatingDescription || !task.title}
              >
                {generatingDescription ? (
                  <Loader2 className="size-3 mr-1 animate-spin" />
                ) : (
                  <Sparkles className="size-3 mr-1" />
                )}
                Generate description
              </Button>
            )}
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
          {detectedSessionId && task.claude_conversation_id && detectedSessionId !== task.claude_conversation_id && (
            <div className="shrink-0 bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-sm text-amber-500">
                Session mismatch: terminal using {detectedSessionId}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="ml-auto h-6 text-xs"
                onClick={handleUpdateSessionId}
              >
                Update DB
              </Button>
            </div>
          )}
          <div className="flex-1 min-h-0">
            {project?.path ? (
              <Terminal
                key={terminalKey}
                taskId={task.id}
                cwd={project.path}
                mode={task.terminal_mode || 'claude-code'}
                sessionId={task.claude_conversation_id || task.claude_session_id || undefined}
                existingSessionId={task.claude_conversation_id || task.claude_session_id || undefined}
                initialPrompt={getQuickRunPrompt(task.id)}
                onSessionCreated={handleSessionCreated}
                onSessionInvalid={handleSessionInvalid}
                onReady={(sendInput) => { sendInputRef.current = sendInput }}
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

          {/* Terminal mode bar */}
          <div className="shrink-0 border-t border-neutral-800 bg-neutral-900 px-3 py-2 flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Mode:</span>
            <Select
              value={task.terminal_mode || 'claude-code'}
              onValueChange={(value) => handleModeChange(value as TerminalMode)}
            >
              <SelectTrigger size="sm" className="w-36 h-7 text-xs bg-neutral-800 border-neutral-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="claude-code">Claude Code</SelectItem>
                <SelectItem value="codex">Codex</SelectItem>
                <SelectItem value="terminal">Terminal</SelectItem>
              </SelectContent>
            </Select>

            {(task.terminal_mode === 'claude-code' || !task.terminal_mode) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-auto h-7 text-xs"
                    onClick={handleSyncSessionName}
                  >
                    Sync name
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Rename Claude session to match task title</TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    'h-7 text-xs',
                    task.terminal_mode !== 'claude-code' && task.terminal_mode && 'ml-auto'
                  )}
                  onClick={handleInjectTitle}
                >
                  Inject task title
                </Button>
              </TooltipTrigger>
              <TooltipContent>Insert task title into terminal (⌘I)</TooltipContent>
            </Tooltip>
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
