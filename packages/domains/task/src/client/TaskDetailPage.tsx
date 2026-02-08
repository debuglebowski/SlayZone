import { useState, useEffect, useRef, useCallback } from 'react'
import { MoreHorizontal, Archive, Trash2, AlertTriangle, RotateCw, RefreshCcw, Link2, Sparkles, Loader2, Terminal as TerminalIcon, Globe, Settings2, GitBranch, Pencil } from 'lucide-react'
import type { Task, PanelVisibility } from '@slayzone/task/shared'
import type { BrowserTabsState } from '@slayzone/task-browser/shared'
import type { Tag } from '@slayzone/tags/shared'
import type { Project } from '@slayzone/projects/shared'
import type { TerminalMode, ClaudeAvailability } from '@slayzone/terminal/shared'
import { Button, PanelToggle } from '@slayzone/ui'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@slayzone/ui'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@slayzone/ui'
import { Input } from '@slayzone/ui'
import { DeleteTaskDialog } from './DeleteTaskDialog'
import { Tooltip, TooltipTrigger, TooltipContent } from '@slayzone/ui'
import { TaskMetadataSidebar } from './TaskMetadataSidebar'
import { RichTextEditor } from '@slayzone/editor'
import { markSkipCache, usePty } from '@slayzone/terminal'
import { TerminalContainer } from '@slayzone/task-terminals'
import { GitPanel, GitDiffPanel, MergePanel } from '@slayzone/worktrees'
import { cn } from '@slayzone/ui'
import { BrowserPanel } from '@slayzone/task-browser'
import { usePanelSizes } from './usePanelSizes'
import { ResizeHandle } from './ResizeHandle'
// ErrorBoundary should be provided by the app when rendering this component

interface TaskDetailPageProps {
  taskId: string
  isActive?: boolean
  onBack: () => void
  onTaskUpdated: (task: Task) => void
  onArchiveTask?: (taskId: string) => Promise<void>
  onDeleteTask?: (taskId: string) => Promise<void>
  onNavigateToTask?: (taskId: string) => void
}

export function TaskDetailPage({
  taskId,
  isActive,
  onBack,
  onTaskUpdated,
  onArchiveTask,
  onDeleteTask
}: TaskDetailPageProps): React.JSX.Element {
  // Main tab session ID format used by TerminalContainer/useTaskTerminals.
  const getMainSessionId = useCallback((id: string) => `${id}:${id}`, [])

  const [task, setTask] = useState<Task | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [tags, setTags] = useState<Tag[]>([])
  const [taskTagIds, setTaskTagIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [claudeAvailability, setClaudeAvailability] = useState<ClaudeAvailability | null>(null)

  // Project path validation
  const [projectPathMissing, setProjectPathMissing] = useState(false)

  // PTY context for buffer management
  const { resetTaskState, subscribeSessionDetected, getQuickRunPrompt, getQuickRunCodeMode, clearQuickRunPrompt } = usePty()

  // Detected session ID from /status command
  const [detectedSessionId, setDetectedSessionId] = useState<string | null>(null)
  const codexStatusRequestedTaskIdsRef = useRef<Set<string>>(new Set())

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

  // Track if the main terminal tab is active (for bottom bar visibility)
  const [isMainTabActive, setIsMainTabActive] = useState(true)
  const [flagsInputValue, setFlagsInputValue] = useState('')
  const [isEditingFlags, setIsEditingFlags] = useState(false)
  const flagsInputRef = useRef<HTMLInputElement>(null)

  // Panel visibility state
  const defaultPanelVisibility: PanelVisibility = { terminal: true, browser: false, gitDiff: false, settings: true }
  const [panelVisibility, setPanelVisibility] = useState<PanelVisibility>(defaultPanelVisibility)

  // Browser tabs state
  const defaultBrowserTabs: BrowserTabsState = {
    tabs: [{ id: 'default', url: 'about:blank', title: 'New Tab' }],
    activeTabId: 'default'
  }
  const [browserTabs, setBrowserTabs] = useState<BrowserTabsState>(defaultBrowserTabs)

  // Panel sizes for resizable panels
  const [panelSizes, updatePanelSizes] = usePanelSizes()
  const [isResizing, setIsResizing] = useState(false)

  // Terminal API (exposed via onReady callback)
  const terminalApiRef = useRef<{
    sendInput: (text: string) => Promise<void>
    focus: () => void
    clearBuffer: () => Promise<void>
  } | null>(null)

  // Track first mount for auto-focus
  const isFirstMountRef = useRef(true)
  useEffect(() => {
    isFirstMountRef.current = false
  }, [])

  // Focus terminal when tab becomes active
  useEffect(() => {
    if (isActive && !document.querySelector('[role="dialog"]')) {
      requestAnimationFrame(() => {
        terminalApiRef.current?.focus()
      })
    }
  }, [isActive])

  // Subscribe to session detected events
  useEffect(() => {
    if (!task) return
    return subscribeSessionDetected(getMainSessionId(task.id), setDetectedSessionId)
  }, [task?.id, subscribeSessionDetected, getMainSessionId])

  // Load task data on mount or when taskId changes
  useEffect(() => {
    // Reset transient state when switching tasks
    setLoading(true)
    setDetectedSessionId(null)
    setEditingTitle(false)
    setGeneratingDescription(false)

    const loadData = async (): Promise<void> => {
      const checkProjectPathExists = async (path: string): Promise<boolean> => {
        const pathExists = window.api.files?.pathExists
        if (typeof pathExists === 'function') return pathExists(path)
        console.warn('window.api.files.pathExists is unavailable; skipping path validation')
        return true
      }

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
        // Restore panel visibility and browser tabs (always reset to defaults if not saved)
        setPanelVisibility({
          ...defaultPanelVisibility,
          ...(loadedTask.panel_visibility ?? {})
        })
        if (loadedTask.browser_tabs) {
          setBrowserTabs(loadedTask.browser_tabs)
        } else {
          // Default to first URL from other tasks
          const allTasks = await window.api.db.getTasks()
          let firstUrl = 'about:blank'
          for (const t of allTasks) {
            if (t.id === loadedTask.id) continue
            const url = t.browser_tabs?.tabs?.find(tab => tab.url && tab.url !== 'about:blank')?.url
            if (url) {
              firstUrl = url
              break
            }
          }
          setBrowserTabs({
            tabs: [{ id: 'default', url: firstUrl, title: firstUrl === 'about:blank' ? 'New Tab' : firstUrl }],
            activeTabId: 'default'
          })
        }
        // Find project for this task
        const taskProject = projects.find((p) => p.id === loadedTask.project_id)
        setProject(taskProject || null)
        if (taskProject?.path) {
          const exists = await checkProjectPathExists(taskProject.path)
          setProjectPathMissing(!exists)
        } else {
          setProjectPathMissing(false)
        }
      }
      setTags(loadedTags)
      setTaskTagIds(loadedTaskTags.map((t) => t.id))
      setClaudeAvailability(claudeCheck)
      setLoading(false)
    }

    loadData()
  }, [taskId])

  // Re-check project path on window focus
  useEffect(() => {
    if (!project?.path) return

    const checkProjectPathExists = async (path: string): Promise<boolean> => {
      const pathExists = window.api.files?.pathExists
      if (typeof pathExists === 'function') return pathExists(path)
      console.warn('window.api.files.pathExists is unavailable; skipping path validation')
      return true
    }

    const handleFocus = (): void => {
      checkProjectPathExists(project.path!).then((exists) => setProjectPathMissing(!exists))
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [project?.path])

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

  // Handle terminal ready - memoized to prevent effect cascade
  const handleTerminalReady = useCallback((api: {
    sendInput: (text: string) => Promise<void>
    focus: () => void
    clearBuffer: () => Promise<void>
  }) => {
    terminalApiRef.current = api
    // Codex has no "create with session id" command; ask it for current session id on first start.
    if (
      task &&
      task.terminal_mode === 'codex' &&
      !task.codex_conversation_id &&
      !codexStatusRequestedTaskIdsRef.current.has(task.id)
    ) {
      codexStatusRequestedTaskIdsRef.current.add(task.id)
      setTimeout(() => {
        void api.sendInput('/status\r').catch(() => {
          // Ignore: terminal may be closing/remounting
        })
      }, 400)
    }
  }, [task])

  // Update DB with detected session ID
  const handleUpdateSessionId = useCallback(async () => {
    if (!task || !detectedSessionId) return
    const update =
      task.terminal_mode === 'codex'
        ? { id: task.id, codexConversationId: detectedSessionId }
        : { id: task.id, claudeConversationId: detectedSessionId }
    const updated = await window.api.db.updateTask(update)
    setTask(updated)
    onTaskUpdated(updated)
    setDetectedSessionId(null)
  }, [task, detectedSessionId, onTaskUpdated])

  // Persist detected Codex conversation IDs immediately.
  useEffect(() => {
    if (!task || !detectedSessionId || task.terminal_mode !== 'codex') return
    if (task.codex_conversation_id === detectedSessionId) {
      setDetectedSessionId(null)
      return
    }

    let cancelled = false
    void (async () => {
      const updated = await window.api.db.updateTask({
        id: task.id,
        codexConversationId: detectedSessionId
      })
      if (cancelled) return
      setTask(updated)
      onTaskUpdated(updated)
      setDetectedSessionId(null)
    })()

    return () => {
      cancelled = true
    }
  }, [task, detectedSessionId, onTaskUpdated])

  // Handle invalid session (e.g., "No conversation found" error)
  const handleSessionInvalid = useCallback(async () => {
    if (!task) return
    const mainSessionId = getMainSessionId(task.id)

    // Clear the stale session ID from the database
    const updated = await window.api.db.updateTask({
      id: task.id,
      claudeConversationId: null
    })
    setTask(updated)
    onTaskUpdated(updated)

    // Kill the current PTY so we can restart fresh
    await window.api.pty.kill(mainSessionId)
  }, [task, onTaskUpdated, getMainSessionId])

  // Restart terminal (kill PTY, remount, keep session for --resume)
  const handleRestartTerminal = useCallback(async () => {
    if (!task) return
    const mainSessionId = getMainSessionId(task.id)
    resetTaskState(mainSessionId)
    await window.api.pty.kill(mainSessionId)
    await new Promise((r) => setTimeout(r, 100))
    markSkipCache(mainSessionId)
    setTerminalKey((k) => k + 1)
  }, [task, resetTaskState, getMainSessionId])

  // Reset terminal (kill PTY, clear session ID, remount fresh)
  const handleResetTerminal = useCallback(async () => {
    if (!task) return
    const mainSessionId = getMainSessionId(task.id)
    resetTaskState(mainSessionId)
    await window.api.pty.kill(mainSessionId)
    // Clear session ID so new session starts fresh
    const updated = await window.api.db.updateTask({
      id: task.id,
      claudeConversationId: null
    })
    setTask(updated)
    onTaskUpdated(updated)
    await new Promise((r) => setTimeout(r, 100))
    markSkipCache(mainSessionId)
    setTerminalKey((k) => k + 1)
  }, [task, resetTaskState, onTaskUpdated, getMainSessionId])

  // Re-attach terminal (remount without killing PTY - reuses cached terminal)
  const handleReattachTerminal = useCallback(() => {
    if (!task) return
    setTerminalKey((k) => k + 1)
  }, [task])

  // Sync Claude session name with task title
  const handleSyncSessionName = useCallback(async () => {
    if (!task || !terminalApiRef.current) return
    await terminalApiRef.current.sendInput(`/rename ${task.title}\r`)
  }, [task])

  // Inject task title into terminal (no execute)
  const handleInjectTitle = useCallback(async () => {
    if (!task || !terminalApiRef.current) return
    await terminalApiRef.current.sendInput(task.title)
  }, [task])

  // Inject task description into terminal (no execute)
  const handleInjectDescription = useCallback(async () => {
    if (!terminalApiRef.current || !descriptionValue) return
    // Strip HTML tags to get plain text
    const tmp = document.createElement('div')
    tmp.innerHTML = descriptionValue
    const plainText = tmp.textContent || tmp.innerText || ''
    if (plainText.trim()) {
      await terminalApiRef.current.sendInput(plainText.trim())
    }
  }, [descriptionValue])

  // Cmd+I (title), Cmd+Shift+I (description), Cmd+Shift+K (clear terminal buffer)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (!isActive) return
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        void terminalApiRef.current?.clearBuffer()
        return
      }
      if (e.metaKey && e.key === 'i') {
        e.preventDefault()
        if (e.shiftKey) {
          handleInjectDescription()
        } else {
          handleInjectTitle()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [isActive, handleInjectTitle, handleInjectDescription])

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
      // Main tab session ID format: ${taskId}:${taskId}
      const mainSessionId = `${task.id}:${task.id}`
      // Reset state FIRST to ignore any in-flight data
      resetTaskState(mainSessionId)
      // Now kill the PTY (any data it sends will be ignored)
      await window.api.pty.kill(mainSessionId)
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
      markSkipCache(mainSessionId)
      setTerminalKey((k) => k + 1)
    },
    [task, onTaskUpdated, resetTaskState]
  )

  // Handle dangerously skip permissions toggle
  const getProviderFlagsForMode = useCallback((currentTask: Task): string => {
    if (currentTask.terminal_mode === 'claude-code') return currentTask.claude_flags ?? ''
    if (currentTask.terminal_mode === 'codex') return currentTask.codex_flags ?? ''
    return ''
  }, [])

  const handleFlagsSave = useCallback(
    async (nextValue: string) => {
      if (!task || task.terminal_mode === 'terminal') return
      const currentValue = getProviderFlagsForMode(task)
      if (currentValue === nextValue) return

      const update =
        task.terminal_mode === 'claude-code'
          ? { id: task.id, claudeFlags: nextValue }
          : { id: task.id, codexFlags: nextValue }

      const updated = await window.api.db.updateTask(update)
      setTask(updated)
      onTaskUpdated(updated)

      const mainSessionId = `${task.id}:${task.id}`
      resetTaskState(mainSessionId)
      await window.api.pty.kill(mainSessionId)
      await new Promise((r) => setTimeout(r, 100))
      markSkipCache(mainSessionId)
      setTerminalKey((k) => k + 1)
    },
    [task, getProviderFlagsForMode, onTaskUpdated, resetTaskState]
  )

  const handleSetDefaultFlags = useCallback(async () => {
    if (!task || task.terminal_mode === 'terminal') return
    const settingsKey =
      task.terminal_mode === 'claude-code' ? 'default_claude_flags' : 'default_codex_flags'
    const fallback =
      task.terminal_mode === 'claude-code'
        ? '--dangerously-skip-permissions'
        : '--full-auto --search'
    const defaultFlags = (await window.api.settings.get(settingsKey)) ?? fallback
    setFlagsInputValue(defaultFlags)
    await handleFlagsSave(defaultFlags)
  }, [task, handleFlagsSave])

  useEffect(() => {
    if (!task) return
    setFlagsInputValue(getProviderFlagsForMode(task))
    setIsEditingFlags(false)
  }, [task, getProviderFlagsForMode])

  useEffect(() => {
    if (!isEditingFlags) return
    requestAnimationFrame(() => {
      flagsInputRef.current?.focus()
      flagsInputRef.current?.select()
    })
  }, [isEditingFlags])

  // Handle panel visibility toggle
  const handlePanelToggle = useCallback(
    async (panelId: string, active: boolean) => {
      if (!task) return
      const newVisibility = { ...panelVisibility, [panelId]: active }
      setPanelVisibility(newVisibility)
      // Persist to DB
      const updated = await window.api.db.updateTask({
        id: task.id,
        panelVisibility: newVisibility
      })
      setTask(updated)
      onTaskUpdated(updated)
    },
    [task, panelVisibility, onTaskUpdated]
  )

  // Cmd+T/B/G/S for panel toggles
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (!isActive) return
      if (e.metaKey && !e.shiftKey) {
        if (e.key === 't') {
          e.preventDefault()
          handlePanelToggle('terminal', !panelVisibility.terminal)
        } else if (e.key === 'b') {
          e.preventDefault()
          handlePanelToggle('browser', !panelVisibility.browser)
        } else if (e.key === 'g') {
          e.preventDefault()
          handlePanelToggle('gitDiff', !panelVisibility.gitDiff)
        } else if (e.key === 's') {
          e.preventDefault()
          handlePanelToggle('settings', !panelVisibility.settings)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isActive, panelVisibility, handlePanelToggle])

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
        task.terminal_mode
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

  // Wrapper for GitPanel that calls API and notifies parent
  const updateTaskAndNotify = async (data: { id: string; worktreePath?: string | null; worktreeParentBranch?: string | null; browserUrl?: string | null; status?: Task['status'] }): Promise<Task> => {
    // If worktreePath is changing, kill old PTY first so terminal restarts with new cwd
    if (data.worktreePath !== undefined) {
      const mainSessionId = `${data.id}:${data.id}`
      resetTaskState(mainSessionId)
      await window.api.pty.kill(mainSessionId)
      markSkipCache(mainSessionId)
    }

    const updated = await window.api.db.updateTask(data)
    handleTaskUpdate(updated)

    // Force terminal remount if worktreePath changed
    if (data.worktreePath !== undefined) {
      setTerminalKey(k => k + 1)
    }

    return updated
  }

  // Handler for browser tabs changes
  const handleBrowserTabsChange = useCallback(async (tabs: BrowserTabsState) => {
    setBrowserTabs(tabs)
    if (!task) return
    // Persist to DB (debounced via the tab state itself)
    await window.api.db.updateTask({
      id: task.id,
      browserTabs: tabs
    })
  }, [task])

  const handleTagsChange = (newTagIds: string[]): void => {
    setTaskTagIds(newTagIds)
  }

  const handleArchive = async (): Promise<void> => {
    if (!task) return
    if (onArchiveTask) {
      await onArchiveTask(task.id)
    } else {
      await window.api.db.archiveTask(task.id)
    }
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
              <PanelToggle
                panels={[
                  { id: 'terminal', icon: TerminalIcon, label: 'Terminal', active: panelVisibility.terminal, shortcut: '⌘T' },
                  { id: 'browser', icon: Globe, label: 'Browser', active: panelVisibility.browser, shortcut: '⌘B' },
                  { id: 'settings', icon: Settings2, label: 'Settings', active: panelVisibility.settings, shortcut: '⌘S' },
                  { id: 'gitDiff', icon: GitBranch, label: 'Git diff', active: panelVisibility.gitDiff, shortcut: '⌘G' },
                ]}
                onChange={handlePanelToggle}
              />

              <div className="h-6 w-px bg-border" />

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

      {/* Split view: terminal | browser | settings | git diff */}
      <div className="flex-1 flex min-h-0">
        {/* Terminal Panel */}
        {panelVisibility.terminal && (
        <div className={cn(
          "min-w-0 bg-[#0a0a0a] flex flex-col",
          panelVisibility.browser ? "flex-1 min-w-[300px]" : "flex-1"
        )}>
          {projectPathMissing && project?.path && (
            <div className="shrink-0 bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-sm text-amber-500">
                Project path not found: <code className="bg-amber-500/10 px-1 rounded">{project.path}</code>
              </span>
            </div>
          )}
          {claudeAvailability && !claudeAvailability.available && (
            <div className="shrink-0 bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center gap-2 text-amber-500">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">
                Claude Code CLI not found. Install it to use AI features.
              </span>
            </div>
          )}
          {(() => {
            const currentConversationId = task.terminal_mode === 'codex'
              ? task.codex_conversation_id
              : (task.claude_conversation_id || task.claude_session_id)
            return (
              detectedSessionId &&
              currentConversationId &&
              detectedSessionId !== currentConversationId
            )
          })() && (
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
          {/* Terminal + mode bar wrapper */}
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0">
              {task.merge_state ? (
                <MergePanel
                  task={task}
                  projectPath={project?.path ?? ''}
                  onUpdateTask={updateTaskAndNotify}
                  onTaskUpdated={(t) => { setTask(t); onTaskUpdated(t) }}
                />
              ) : isResizing ? (
                <div className="h-full bg-[#0a0a0a]" />
              ) : project?.path && !projectPathMissing ? (
                <TerminalContainer
                  key={`${terminalKey}-${task.worktree_path || ''}`}
                  taskId={task.id}
                  cwd={task.worktree_path || project.path}
                  defaultMode={task.terminal_mode}
                  conversationId={task.terminal_mode === 'claude-code'
                    ? (task.claude_conversation_id || task.claude_session_id || undefined)
                    : task.terminal_mode === 'codex'
                      ? (task.codex_conversation_id || undefined)
                      : undefined}
                  existingConversationId={task.terminal_mode === 'claude-code'
                    ? (task.claude_conversation_id || task.claude_session_id || undefined)
                    : task.terminal_mode === 'codex'
                      ? (task.codex_conversation_id || undefined)
                      : undefined}
                  initialPrompt={getQuickRunPrompt(task.id)}
                  codeMode={getQuickRunCodeMode(task.id)}
                  providerFlags={getProviderFlagsForMode(task)}
                  autoFocus={isFirstMountRef.current}
                  onConversationCreated={handleSessionCreated}
                  onSessionInvalid={handleSessionInvalid}
                  onReady={handleTerminalReady}
                  onMainTabActiveChange={setIsMainTabActive}
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

            {/* Terminal mode bar - only active on main tab */}
            <Tooltip open={isMainTabActive ? false : undefined}>
              <TooltipTrigger asChild>
                <div className="shrink-0 px-2 py-2 border-t border-neutral-800">
                  <div className={cn(
                    "flex items-center gap-3 transition-opacity",
                    !isMainTabActive && "opacity-40 pointer-events-none"
                  )}>
            <Select
              value={task.terminal_mode}
              onValueChange={(value) => handleModeChange(value as TerminalMode)}
            >
              <SelectTrigger
                data-testid="terminal-mode-trigger"
                size="sm"
                className="w-36 h-7 text-xs bg-neutral-800 border-neutral-700"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="claude-code">Claude Code</SelectItem>
                <SelectItem value="codex">Codex</SelectItem>
                <SelectItem value="terminal">Terminal</SelectItem>
              </SelectContent>
            </Select>

            {task.terminal_mode !== 'terminal' && (
              isEditingFlags ? (
                <Input
                  ref={flagsInputRef}
                  value={flagsInputValue}
                  onChange={(e) => setFlagsInputValue(e.target.value)}
                  onBlur={() => {
                    setIsEditingFlags(false)
                    void handleFlagsSave(flagsInputValue)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      setIsEditingFlags(false)
                      void handleFlagsSave(flagsInputValue)
                    } else if (e.key === 'Escape') {
                      e.preventDefault()
                      setFlagsInputValue(getProviderFlagsForMode(task))
                      setIsEditingFlags(false)
                    }
                  }}
                  placeholder="Flags"
                  className="h-7 text-xs bg-neutral-800 border-neutral-700 w-72"
                />
              ) : (
                flagsInputValue.trim().length === 0 ? (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="!h-8 !min-h-8 text-xs"
                      onClick={() => setIsEditingFlags(true)}
                    >
                      Set flags
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="!h-8 !min-h-8 text-xs"
                      onClick={() => { void handleSetDefaultFlags() }}
                    >
                      Set default flags
                    </Button>
                  </div>
                ) : (
                  <div className="relative h-7 w-fit max-w-72 px-1 pr-7">
                    <div className="min-w-0 h-full flex items-center">
                      <div className="text-xs text-neutral-200 truncate">
                        {flagsInputValue}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-1/2 -translate-y-1/2 h-6 w-6"
                      onClick={() => setIsEditingFlags(true)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                  </div>
                )
              )
            )}

            <div className="ml-auto flex items-center gap-3">
              {task.terminal_mode === 'claude-code' && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="!h-8 !min-h-8 text-xs"
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
                    className="!h-8 !min-h-8 text-xs"
                    onClick={handleInjectTitle}
                  >
                    Inject title
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Insert task title into terminal (⌘I)</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="!h-8 !min-h-8 text-xs"
                    onClick={handleInjectDescription}
                  >
                    Inject description
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Insert task description into terminal (⌘⇧I)</TooltipContent>
              </Tooltip>
            </div>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>Switch to Main tab to use these controls</TooltipContent>
            </Tooltip>
          </div>
        </div>
        )}

        {/* Resize handle: Terminal | Browser */}
        {panelVisibility.terminal && panelVisibility.browser && (
          <ResizeHandle
            width={panelSizes.browser}
            minWidth={200}
            onWidthChange={(w) => updatePanelSizes({ browser: w })}
            onDragStart={() => setIsResizing(true)}
            onDragEnd={() => setIsResizing(false)}
          />
        )}

        {/* Browser Panel */}
        {panelVisibility.browser && (
          <div className="shrink-0 border-l" style={{ width: panelSizes.browser }}>
            <BrowserPanel
              className="h-full"
              tabs={browserTabs}
              onTabsChange={handleBrowserTabsChange}
              taskId={task.id}
              isResizing={isResizing}
            />
          </div>
        )}

        {/* Resize handle: Browser | Settings or Terminal | Settings */}
        {panelVisibility.settings && (panelVisibility.browser || panelVisibility.terminal) && (
          <ResizeHandle
            width={panelSizes.settings}
            minWidth={200}
            onWidthChange={(w) => updatePanelSizes({ settings: w })}
            onDragStart={() => setIsResizing(true)}
            onDragEnd={() => setIsResizing(false)}
          />
        )}

        {/* Settings Panel */}
        {panelVisibility.settings && (
        <div data-testid="task-settings-panel" className="shrink-0 border-l flex flex-col overflow-y-auto" style={{ width: panelSizes.settings }}>
          {/* Description */}
          <div className="p-4 flex-1 flex flex-col min-h-0">
            <RichTextEditor
              value={descriptionValue}
              onChange={setDescriptionValue}
              onBlur={handleDescriptionSave}
              placeholder="Add description..."
              minHeight="150px"
              maxHeight="300px"
              className="bg-muted/30 rounded-lg p-3"
              testId="task-description-editor"
            />
            {task.terminal_mode !== 'terminal' && (
              <Button
                data-testid="generate-description-button"
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

          {/* Git */}
          <div data-testid="task-git-panel" className="px-4 py-3 border-t">
            <GitPanel
              task={task}
              projectPath={project?.path ?? null}
              onUpdateTask={updateTaskAndNotify}
              onTaskUpdated={(t) => { setTask(t); onTaskUpdated(t) }}
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
        )}

        {/* Resize handle: Settings | Git Diff or Browser | Git Diff or Terminal | Git Diff */}
        {panelVisibility.gitDiff && (panelVisibility.settings || panelVisibility.browser || panelVisibility.terminal) && (
          <ResizeHandle
            width={panelSizes.gitDiff}
            minWidth={50}
            onWidthChange={(w) => updatePanelSizes({ gitDiff: w })}
            onDragStart={() => setIsResizing(true)}
            onDragEnd={() => setIsResizing(false)}
          />
        )}

        {/* Git Diff Panel */}
        {panelVisibility.gitDiff && (
          <div className="shrink-0 border-l" style={{ width: panelSizes.gitDiff }}>
            <GitDiffPanel
              task={task}
              projectPath={project?.path ?? null}
              visible={panelVisibility.gitDiff}
              pollIntervalMs={5000}
            />
          </div>
        )}
      </div>

      <DeleteTaskDialog
        task={task}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onDeleted={handleDeleteConfirm}
        onDeleteTask={onDeleteTask}
      />
    </div>
  )
}
