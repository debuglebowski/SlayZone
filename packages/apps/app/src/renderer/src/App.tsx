import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { AlertTriangle, TerminalSquare } from 'lucide-react'
import type { Task } from '@slayzone/task/shared'
import type { Project } from '@slayzone/projects/shared'
import type { Tag } from '@slayzone/tags/shared'
// Domains
import {
  KanbanBoard,
  FilterBar,
  useTasksData,
  useFilterState,
  applyFilters,
  type Column
} from '@slayzone/tasks'
import { CreateTaskDialog, EditTaskDialog, DeleteTaskDialog, TaskDetailPage } from '@slayzone/task'
import { CreateProjectDialog, ProjectSettingsDialog, DeleteProjectDialog } from '@slayzone/projects'
import { UserSettingsDialog, useViewState } from '@slayzone/settings'
import { OnboardingDialog } from '@slayzone/onboarding'
import { usePty } from '@slayzone/terminal/client'
import type { TerminalState } from '@slayzone/terminal/shared'
// Shared
import { SearchDialog } from '@/components/dialogs/SearchDialog'
import {
  Button,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  Toaster
} from '@slayzone/ui'
import { SidebarProvider } from '@slayzone/ui'
import { AppSidebar } from '@/components/sidebar/AppSidebar'
import { TabBar } from '@/components/tabs/TabBar'
import { recordDiagnosticsTimeline, updateDiagnosticsContext } from '@/lib/diagnosticsClient'
import {
  DesktopNotificationToggle,
  NotificationButton,
  NotificationSidePanel,
  useAttentionTasks,
  useNotificationState
} from '@/components/notifications'
import { UsagePopover } from '@/components/usage/UsagePopover'
import { useUsage } from '@/components/usage/useUsage'

function App(): React.JSX.Element {
  // Core data from domain hook
  const {
    tasks,
    projects,
    tags,
    taskTags,
    blockedTaskIds,
    setTasks,
    setProjects,
    setTags,
    updateTask,
    moveTask,
    reorderTasks,
    archiveTask,
    archiveTasks,
    deleteTask,
    contextMenuUpdate,
    updateProject,
    deleteProject
  } = useTasksData()

  // View state (tabs + selected project, persisted)
  const [tabs, activeTabIndex, selectedProjectId, setTabs, setActiveTabIndex, setSelectedProjectId] =
    useViewState()

  // Filter state (persisted per project)
  const [filter, setFilter] = useFilterState(selectedProjectId)
  // Dialog state
  const [createOpen, setCreateOpen] = useState(false)
  const [createTaskDefaults, setCreateTaskDefaults] = useState<{
    status?: Task['status']
    priority?: number
    dueDate?: string | null
  }>({})
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [deletingTask, setDeletingTask] = useState<Task | null>(null)
  const [createProjectOpen, setCreateProjectOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [deletingProject, setDeletingProject] = useState<Project | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsInitialTab, setSettingsInitialTab] = useState<string>('general')
  const [onboardingOpen, setOnboardingOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [completeTaskDialogOpen, setCompleteTaskDialogOpen] = useState(false)
  const [zenMode, setZenMode] = useState(false)
  const [convertingTask, setConvertingTask] = useState<Task | null>(null)
  const convertResolveRef = useRef<((task: Task) => void) | null>(null)

  // Project path validation
  const [projectPathMissing, setProjectPathMissing] = useState(false)
  const validateProjectPath = useCallback(async (project: Project | undefined) => {
    if (!project?.path) {
      setProjectPathMissing(false)
      return
    }
    const fn = window.api.files?.pathExists
    if (typeof fn !== 'function') return
    const exists = await fn(project.path)
    setProjectPathMissing(!exists)
  }, [])

  // Inline project rename state
  const [projectNameValue, setProjectNameValue] = useState('')
  const projectNameInputRef = useRef<HTMLTextAreaElement>(null)

  // Terminal state tracking for tab indicators
  const ptyContext = usePty()
  const [terminalStates, setTerminalStates] = useState<Map<string, TerminalState>>(new Map())

  // Closed tabs stack for Cmd+Shift+T reopen
  const closedTabsRef = useRef<Extract<typeof tabs[number], { type: 'task' }>[]>([])

  // Usage & notification state
  const { data: usageData, refresh: refreshUsage } = useUsage()
  const [notificationState, setNotificationState] = useNotificationState()
  const { attentionTasks, refresh: refreshAttentionTasks } = useAttentionTasks(
    tasks,
    notificationState.filterCurrentProject ? selectedProjectId : null
  )

  const previousProjectRef = useRef<string | null>(selectedProjectId)
  const previousActiveTabRef = useRef<string>('home')
  const previousNotificationLockedRef = useRef(notificationState.isLocked)
  const previousNotificationProjectFilterRef = useRef(notificationState.filterCurrentProject)

  // Get task IDs from open tabs
  const openTaskIds = useMemo(
    () => tabs.filter((t): t is { type: 'task'; taskId: string; title: string } => t.type === 'task').map((t) => t.taskId),
    [tabs]
  )

  // Subscribe to terminal state changes for open tabs
  useEffect(() => {
    const unsubscribes: (() => void)[] = []

    for (const taskId of openTaskIds) {
      // Main terminal sessionId format: taskId:taskId (matches useTaskTerminals.getSessionId)
      const mainSessionId = `${taskId}:${taskId}`

      // Initialize with current state
      const currentState = ptyContext.getState(mainSessionId)
      setTerminalStates((prev) => {
        const next = new Map(prev)
        next.set(taskId, currentState)
        return next
      })

      // Subscribe to changes
      const unsub = ptyContext.subscribeState(mainSessionId, (newState) => {
        setTerminalStates((prev) => {
          const next = new Map(prev)
          next.set(taskId, newState)
          return next
        })
      })
      unsubscribes.push(unsub)
    }

    // Cleanup closed tabs from state
    setTerminalStates((prev) => {
      const openSet = new Set(openTaskIds)
      const next = new Map(prev)
      for (const key of next.keys()) {
        if (!openSet.has(key)) next.delete(key)
      }
      return next
    })

    return () => unsubscribes.forEach((fn) => fn())
  }, [openTaskIds, ptyContext])

  // Tab management
  const openTask = (taskId: string): void => {
    const existing = tabs.findIndex((t) => t.type === 'task' && t.taskId === taskId)
    if (existing >= 0) {
      setActiveTabIndex(existing)
    } else {
      const task = tasks.find((t) => t.id === taskId)
      const title = task?.title || 'Task'
      const status = task?.status
      const isSubTask = !!task?.parent_id
      const isTemporary = !!task?.is_temporary
      setTabs([...tabs, { type: 'task', taskId, title, status, isSubTask, isTemporary }])
      setActiveTabIndex(tabs.length)
    }
  }

  const openTaskInBackground = (taskId: string): void => {
    const existing = tabs.findIndex((t) => t.type === 'task' && t.taskId === taskId)
    if (existing < 0) {
      const task = tasks.find((t) => t.id === taskId)
      const title = task?.title || 'Task'
      const status = task?.status
      const isSubTask = !!task?.parent_id
      const isTemporary = !!task?.is_temporary
      setTabs([...tabs, { type: 'task', taskId, title, status, isSubTask, isTemporary }])
    }
  }

  const closeTab = (index: number): void => {
    if (index === 0) return
    const tab = tabs[index]
    if (tab?.type === 'task') {
      const task = tasks.find((t) => t.id === tab.taskId)
      if (task?.is_temporary) {
        // Ephemeral: kill PTY + delete from DB + remove from state
        window.api.pty.kill(`${tab.taskId}:${tab.taskId}`)
        window.api.db.deleteTask(tab.taskId)
        setTasks((prev) => prev.filter((t) => t.id !== tab.taskId))
      } else {
        closedTabsRef.current.push(tab)
        if (closedTabsRef.current.length > 20) closedTabsRef.current.shift()
      }
    }
    const newTabs = tabs.filter((_, i) => i !== index)
    setTabs(newTabs)
    if (activeTabIndex >= index) {
      setActiveTabIndex(Math.max(0, activeTabIndex - 1))
    }
  }

  const reopenClosedTab = (): void => {
    const taskIds = new Set(tasks.map((t) => t.id))
    while (closedTabsRef.current.length > 0) {
      const tab = closedTabsRef.current.pop()!
      if (!taskIds.has(tab.taskId)) continue
      if (tabs.some((t) => t.type === 'task' && t.taskId === tab.taskId)) continue
      openTask(tab.taskId)
      return
    }
  }

  const reorderTabs = (fromIndex: number, toIndex: number): void => {
    const newTabs = [...tabs]
    const [moved] = newTabs.splice(fromIndex, 1)
    newTabs.splice(toIndex, 0, moved)
    setTabs(newTabs)
    // Update active index if needed
    if (activeTabIndex === fromIndex) {
      setActiveTabIndex(toIndex)
    } else if (fromIndex < activeTabIndex && toIndex >= activeTabIndex) {
      setActiveTabIndex(activeTabIndex - 1)
    } else if (fromIndex > activeTabIndex && toIndex <= activeTabIndex) {
      setActiveTabIndex(activeTabIndex + 1)
    }
  }

  const goBack = (): void => {
    if (activeTabIndex > 0) closeTab(activeTabIndex)
  }

  // Sync tab titles/status and remove tabs for deleted tasks
  useEffect(() => {
    const taskIds = new Set(tasks.map((t) => t.id))
    setTabs((prev) => {
      for (const tab of prev) {
        if (tab.type === 'task' && !taskIds.has(tab.taskId)) {
          closedTabsRef.current.push(tab)
          if (closedTabsRef.current.length > 20) closedTabsRef.current.shift()
        }
      }
      const filtered = prev.filter((tab) => tab.type === 'home' || taskIds.has(tab.taskId))
      if (filtered.length < prev.length) {
        setActiveTabIndex((idx) => Math.min(idx, filtered.length - 1))
      }
      return filtered.map((tab) => {
        if (tab.type !== 'task') return tab
        const task = tasks.find((t) => t.id === tab.taskId)
        if (task) {
          const isSubTask = !!task.parent_id
          const isTemporary = !!task.is_temporary
          if (task.title !== tab.title || task.status !== tab.status || isSubTask !== tab.isSubTask || isTemporary !== tab.isTemporary) {
            return { ...tab, title: task.title, status: task.status, isSubTask, isTemporary }
          }
        }
        return tab
      })
    })
  }, [tasks, setTabs, setActiveTabIndex])

  // Startup cleanup: delete orphaned temporary tasks (no open tab)
  const didCleanupRef = useRef(false)
  useEffect(() => {
    if (didCleanupRef.current || tasks.length === 0) return
    didCleanupRef.current = true
    const openTabTaskIds = new Set(
      tabs.filter((t): t is Extract<typeof t, { type: 'task' }> => t.type === 'task').map((t) => t.taskId)
    )
    for (const task of tasks) {
      if (task.is_temporary && !openTabTaskIds.has(task.id)) {
        window.api.pty.kill(`${task.id}:${task.id}`)
        window.api.db.deleteTask(task.id)
        setTasks((prev) => prev.filter((t) => t.id !== task.id))
      }
    }
  }, [tasks, tabs, setTasks])

  // Sync project name value
  useEffect(() => {
    if (selectedProjectId) {
      const project = projects.find((p) => p.id === selectedProjectId)
      if (project) setProjectNameValue(project.name)
    }
  }, [selectedProjectId, projects])

  // Validate selected project's path exists on disk
  useEffect(() => {
    validateProjectPath(projects.find((p) => p.id === selectedProjectId))
  }, [selectedProjectId, projects, validateProjectPath])

  // Re-check project path on window focus
  useEffect(() => {
    const project = projects.find((p) => p.id === selectedProjectId)
    if (!project?.path) return
    const handleFocus = (): void => { validateProjectPath(project) }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [selectedProjectId, projects, validateProjectPath])

  // Computed values
  const projectTasks = selectedProjectId
    ? tasks.filter((t) => t.project_id === selectedProjectId)
    : tasks
  const displayTasks = applyFilters(projectTasks, filter, taskTags)
  const projectsMap = new Map(projects.map((p) => [p.id, p]))

  useEffect(() => {
    const activeTab = tabs[activeTabIndex]
    updateDiagnosticsContext({
      activeTabIndex,
      activeTabType: activeTab?.type ?? 'unknown',
      activeTaskId: activeTab?.type === 'task' ? activeTab.taskId : null,
      openTaskTabs: tabs.filter((t) => t.type === 'task').length,
      selectedProjectId,
      selectedProjectName: projects.find((p) => p.id === selectedProjectId)?.name ?? null,
      taskCount: tasks.length,
      visibleTaskCount: displayTasks.length,
      notificationPanelLocked: notificationState.isLocked,
      notificationFilterCurrentProject: notificationState.filterCurrentProject,
      projectPathMissing
    })
  }, [
    activeTabIndex,
    tabs,
    selectedProjectId,
    projects,
    tasks.length,
    displayTasks.length,
    notificationState.isLocked,
    notificationState.filterCurrentProject,
    projectPathMissing
  ])

  useEffect(() => {
    if (previousProjectRef.current === selectedProjectId) return
    recordDiagnosticsTimeline('project_changed', {
      from: previousProjectRef.current,
      to: selectedProjectId
    })
    previousProjectRef.current = selectedProjectId
  }, [selectedProjectId])

  useEffect(() => {
    const activeTab = tabs[activeTabIndex]
    const nextTabKey = activeTab?.type === 'task' ? `task:${activeTab.taskId}` : 'home'
    if (previousActiveTabRef.current === nextTabKey) return
    recordDiagnosticsTimeline('tab_changed', {
      from: previousActiveTabRef.current,
      to: nextTabKey,
      activeTabIndex
    })
    previousActiveTabRef.current = nextTabKey
  }, [tabs, activeTabIndex])

  useEffect(() => {
    if (previousNotificationLockedRef.current === notificationState.isLocked) return
    recordDiagnosticsTimeline('notification_lock_changed', {
      from: previousNotificationLockedRef.current,
      to: notificationState.isLocked
    })
    previousNotificationLockedRef.current = notificationState.isLocked
  }, [notificationState.isLocked])

  useEffect(() => {
    if (previousNotificationProjectFilterRef.current === notificationState.filterCurrentProject) return
    recordDiagnosticsTimeline('notification_filter_project_changed', {
      from: previousNotificationProjectFilterRef.current,
      to: notificationState.filterCurrentProject
    })
    previousNotificationProjectFilterRef.current = notificationState.filterCurrentProject
  }, [notificationState.filterCurrentProject])

  // Keyboard shortcuts
  useHotkeys('mod+n', (e) => {
    if (projects.length > 0) {
      e.preventDefault()
      setCreateOpen(true)
    }
  }, { enableOnFormTags: true })


  useHotkeys('mod+k', (e) => {
    e.preventDefault()
    setSearchOpen(true)
  }, { enableOnFormTags: true })

  useHotkeys('mod+w', (e) => {
    e.preventDefault()
    if (activeTabIndex === 0) {
      window.api.window.close()
    } else {
      closeTab(activeTabIndex)
    }
  }, { enableOnFormTags: true })

  useEffect(() => {
    return window.api.app.onCloseTask((taskId) => {
      setTabs((prev) => {
        const index = prev.findIndex((t) => t.type === 'task' && t.taskId === taskId)
        if (index < 1) return prev
        const tab = prev[index]
        if (tab?.type === 'task') {
          closedTabsRef.current.push(tab)
          if (closedTabsRef.current.length > 20) closedTabsRef.current.shift()
        }
        setActiveTabIndex((idx) => idx >= index ? Math.max(0, idx - 1) : idx)
        return prev.filter((_, i) => i !== index)
      })
    })
  }, [setTabs, setActiveTabIndex])

  useEffect(() => {
    return window.api.app.onOpenTask((taskId) => {
      setTabs((prev) => {
        const existing = prev.findIndex((t) => t.type === 'task' && t.taskId === taskId)
        if (existing >= 0) {
          setActiveTabIndex(existing)
          return prev
        }
        setActiveTabIndex(prev.length)
        return [...prev, { type: 'task' as const, taskId, title: 'Task' }]
      })
    })
  }, [setTabs, setActiveTabIndex])

  useEffect(() => {
    return window.api.app.onGoHome(() => {
      setActiveTabIndex(0)
    })
  }, [])

  useEffect(() => {
    return window.api.app.onOpenSettings(() => {
      setSettingsInitialTab('general')
      setSettingsOpen(true)
    })
  }, [])

  useEffect(() => {
    return window.api.app.onOpenProjectSettings(() => {
      if (!selectedProjectId) return
      const project = projects.find((p) => p.id === selectedProjectId)
      if (project) setEditingProject(project)
    })
  }, [selectedProjectId, projects])

  useHotkeys('mod+1,mod+2,mod+3,mod+4,mod+5,mod+6,mod+7,mod+8,mod+9', (e) => {
    e.preventDefault()
    const num = parseInt(e.key, 10)
    if (num < tabs.length) setActiveTabIndex(num)
  }, { enableOnFormTags: true })

  useHotkeys('ctrl+tab', (e) => {
    e.preventDefault()
    setActiveTabIndex((prev) => (prev + 1) % tabs.length)
  }, { enableOnFormTags: true })

  useHotkeys('ctrl+shift+tab', (e) => {
    e.preventDefault()
    setActiveTabIndex((prev) => (prev - 1 + tabs.length) % tabs.length)
  }, { enableOnFormTags: true })

  useHotkeys('mod+shift+t', (e) => {
    e.preventDefault()
    reopenClosedTab()
  }, { enableOnFormTags: true })

  useHotkeys('mod+shift+d', (e) => {
    e.preventDefault()
    const activeTab = tabs[activeTabIndex]
    if (activeTab.type === 'task') {
      setCompleteTaskDialogOpen(true)
    }
  }, { enableOnFormTags: true })

  useHotkeys('mod+j', (e) => {
    e.preventDefault()
    setZenMode(prev => !prev)
  }, { enableOnFormTags: true })

  useHotkeys('escape', () => {
    if (zenMode) setZenMode(false)
  }, { enableOnFormTags: true })

  const handleCompleteTaskConfirm = async (): Promise<void> => {
    const activeTab = tabs[activeTabIndex]
    if (activeTab.type !== 'task') return

    await window.api.db.updateTask({ id: activeTab.taskId, status: 'done' })
    updateTask({ ...tasks.find((t) => t.id === activeTab.taskId)!, status: 'done' })
    closeTab(activeTabIndex)
    setCompleteTaskDialogOpen(false)
  }

  // Scratch terminal (creates unnamed task with terminal mode)
  const handleCreateScratchTerminal = useCallback(async (): Promise<void> => {
    if (!selectedProjectId) return
    // Auto-title: "Terminal N" where N is next available
    const existing = tasks
      .filter((t) => t.project_id === selectedProjectId)
      .map((t) => t.title.match(/^Terminal (\d+)$/))
      .filter(Boolean)
      .map((m) => parseInt(m![1], 10))
    const next = existing.length > 0 ? Math.max(...existing) + 1 : 1
    const task = await window.api.db.createTask({
      projectId: selectedProjectId,
      title: `Terminal ${next}`,
      status: 'in_progress',
      isTemporary: true
    })
    setTasks((prev) => [task, ...prev])
    openTask(task.id)

  }, [selectedProjectId, tasks, setTasks, openTask])

  useEffect(() => {
    return window.api.app.onNewTemporaryTask(() => {
      handleCreateScratchTerminal()
    })
  }, [handleCreateScratchTerminal])

  // Task handlers
  const handleTaskCreated = (task: Task): void => {
    setTasks((prev) => [task, ...prev])
    setCreateOpen(false)
    setCreateTaskDefaults({})

  }

  const handleTaskCreatedAndOpen = (task: Task): void => {
    setTasks((prev) => [task, ...prev])
    setCreateOpen(false)
    setCreateTaskDefaults({})
    openTask(task.id)

  }

  const handleCreateTaskFromColumn = (column: Column): void => {
    const defaults: typeof createTaskDefaults = {}
    if (filter.groupBy === 'status') {
      defaults.status = column.id as Task['status']
    } else if (filter.groupBy === 'priority') {
      const priority = parseInt(column.id.slice(1), 10)
      if (!isNaN(priority)) defaults.priority = priority
    } else if (filter.groupBy === 'due_date') {
      const today = new Date().toISOString().split('T')[0]
      if (column.id === 'today') {
        defaults.dueDate = today
      } else if (column.id === 'this_week') {
        const weekEnd = new Date(today)
        weekEnd.setDate(weekEnd.getDate() + 7)
        defaults.dueDate = weekEnd.toISOString().split('T')[0]
      } else if (column.id === 'overdue') {
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        defaults.dueDate = yesterday.toISOString().split('T')[0]
      }
    }
    setCreateTaskDefaults(defaults)
    setCreateOpen(true)
  }

  const handleTaskUpdated = (task: Task): void => {
    updateTask(task)
    setEditingTask(null)
  }

  const handleConvertTask = (task: Task): Promise<Task> => {
    // Open edit dialog with title cleared so user must name it
    setConvertingTask({ ...task, title: '' })
    return new Promise<Task>((resolve) => {
      convertResolveRef.current = resolve
    })
  }

  const handleConvertTaskSaved = async (task: Task): Promise<void> => {
    // Clear is_temporary flag after edit dialog saves title/status/etc.
    const converted = await window.api.db.updateTask({ id: task.id, isTemporary: false })
    updateTask(converted)
    setConvertingTask(null)
    convertResolveRef.current?.(converted)
    convertResolveRef.current = null
  }

  const handleTaskDeleted = (): void => {
    if (deletingTask) {
      deleteTask(deletingTask.id)
      setDeletingTask(null)
    }
  }

  const handleTaskClick = (task: Task, e: { metaKey: boolean }): void => {
    if (e.metaKey) {
      openTaskInBackground(task.id)
    } else {
      openTask(task.id)
    }
  }

  const handleTaskMove = (taskId: string, newColumnId: string, targetIndex: number): void => {
    moveTask(taskId, newColumnId, targetIndex, filter.groupBy)
  }

  // Project handlers
  const handleProjectCreated = (project: Project): void => {
    setProjects((prev) => [...prev, project])
    setSelectedProjectId(project.id)
    setCreateProjectOpen(false)
  }

  const handleProjectUpdated = (project: Project): void => {
    updateProject(project)
    setEditingProject(null)
    validateProjectPath(project)
  }

  const handleProjectNameSave = async (): Promise<void> => {
    if (!selectedProjectId) return
    const trimmed = projectNameValue.trim()
    if (!trimmed) {
      const project = projects.find((p) => p.id === selectedProjectId)
      if (project) setProjectNameValue(project.name)
      return
    }
    const project = projects.find((p) => p.id === selectedProjectId)
    if (project && trimmed !== project.name) {
      try {
        const updated = await window.api.db.updateProject({
          id: selectedProjectId,
          name: trimmed,
          color: project.color
        })
        updateProject(updated)
      } catch {
        if (project) setProjectNameValue(project.name)
      }
    }
  }

  const handleProjectNameKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleProjectNameSave()
      projectNameInputRef.current?.blur()
    } else if (e.key === 'Escape') {
      const project = projects.find((p) => p.id === selectedProjectId)
      if (project) setProjectNameValue(project.name)
      projectNameInputRef.current?.blur()
    }
  }

  const handleFixProjectPath = useCallback(async (): Promise<void> => {
    const project = projects.find((p) => p.id === selectedProjectId)
    if (!project) return
    const result = await window.api.dialog.showOpenDialog({
      title: 'Select Project Directory',
      defaultPath: project.path || undefined,
      properties: ['openDirectory']
    })
    if (result.canceled || !result.filePaths[0]) return
    const updated = await window.api.db.updateProject({
      id: project.id,
      path: result.filePaths[0]
    })
    updateProject(updated)
    validateProjectPath(updated)
  }, [selectedProjectId, projects, updateProject, validateProjectPath])

  const handleProjectDeleted = (): void => {
    if (deletingProject) {
      deleteProject(deletingProject.id, selectedProjectId, setSelectedProjectId)
      setDeletingProject(null)
    }
  }

  const handleSidebarSelectProject = (projectId: string | null): void => {
    setSelectedProjectId(projectId)
    setActiveTabIndex(0)
  }

  const handleOpenSettings = (): void => {
    setSettingsInitialTab('general')
    setSettingsOpen(true)
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <div id="app-shell" className="h-full w-full flex">
        <AppSidebar
          projects={projects}
          tasks={tasks}
          selectedProjectId={selectedProjectId}
          onSelectProject={handleSidebarSelectProject}
          onAddProject={() => setCreateProjectOpen(true)}
          onProjectSettings={setEditingProject}
          onProjectDelete={setDeletingProject}
          onSettings={handleOpenSettings}
          onTutorial={() => setOnboardingOpen(true)}
          zenMode={zenMode}
        />

        <div id="right-column" className="flex-1 flex flex-col min-w-0 bg-surface-1 pb-2 pr-2">
              <div className={zenMode ? "window-drag-region bg-surface-1 pl-16" : "window-drag-region bg-surface-1"}>
                <div className="window-no-drag">
                  <TabBar
                    tabs={tabs}
                    activeIndex={activeTabIndex}
                    terminalStates={terminalStates}
                    onTabClick={setActiveTabIndex}
                    onTabClose={closeTab}
                    onTabReorder={reorderTabs}
                    rightContent={
                      <div className="flex items-center gap-1">
                        <UsagePopover data={usageData} onRefresh={refreshUsage} />
                        {selectedProjectId && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={handleCreateScratchTerminal}
                                className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <TerminalSquare className="size-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">
                              New temporary task (⌘⇧N)
                            </TooltipContent>
                          </Tooltip>
                        )}
                        <DesktopNotificationToggle
                          enabled={notificationState.desktopEnabled}
                          onToggle={() => {
                            if (notificationState.desktopEnabled) {
                              window.api.pty.dismissAllNotifications()
                            }
                            setNotificationState({ desktopEnabled: !notificationState.desktopEnabled })
                          }}
                        />
                        <NotificationButton
                          active={notificationState.isLocked}
                          onClick={() => setNotificationState({ isLocked: !notificationState.isLocked })}
                        />
                      </div>
                    }
                  />
                </div>
              </div>

              <div id="content-wrapper" className="flex-1 min-h-0 flex">
                <div id="main-area" className="flex-1 min-w-0 relative rounded-lg overflow-hidden bg-background">
                  {tabs.map((tab, i) => (
                    <div
                      key={tab.type === 'home' ? 'home' : tab.taskId}
                      className={`absolute inset-0 ${i !== activeTabIndex ? 'hidden' : ''}`}
                    >
                      {tab.type === 'home' ? (
                        <div className="flex flex-col flex-1 p-6 pt-4 h-full">
                          <header className="mb-4 window-no-drag space-y-2">
                            <div className="flex items-center gap-4">
                              <div className="flex-shrink-0">
                                {selectedProjectId ? (
                                  <textarea
                                    ref={projectNameInputRef}
                                    value={projectNameValue}
                                    onChange={(e) => setProjectNameValue(e.target.value)}
                                    onBlur={handleProjectNameSave}
                                    onKeyDown={handleProjectNameKeyDown}
                                    className="text-2xl font-bold bg-transparent border-none outline-none resize-none cursor-text"
                                    style={{ caretColor: 'currentColor', fieldSizing: 'content' } as React.CSSProperties}
                                    rows={1}
                                  />
                                ) : (
                                  <h1 className="text-2xl font-bold">All Tasks</h1>
                                )}
                              </div>
                              {projects.length > 0 && !(projectPathMissing && selectedProjectId) && (
                                <FilterBar filter={filter} onChange={setFilter} tags={tags} />
                              )}
                            </div>
                          </header>

                          {projects.length === 0 ? (
                            <div className="text-center text-muted-foreground">
                              Click + in sidebar to create a project
                            </div>
                          ) : projectPathMissing && selectedProjectId ? (
                            <div className="flex-1 flex items-center justify-center">
                              <div className="text-center space-y-4">
                                <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
                                <p className="text-lg font-medium">Project path not found</p>
                                <p className="text-sm text-muted-foreground">
                                  <code className="bg-muted px-2 py-1 rounded">{projects.find((p) => p.id === selectedProjectId)?.path}</code>
                                </p>
                                <Button onClick={handleFixProjectPath}>Update path</Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex-1 min-h-0">
                                <KanbanBoard
                                  tasks={displayTasks}
                                  groupBy={filter.groupBy}
                                  sortBy={filter.sortBy}
                                  isActive={activeTabIndex === 0}
                                  onTaskMove={handleTaskMove}
                                  onTaskReorder={reorderTasks}
                                  onTaskClick={handleTaskClick}
                                  onCreateTask={handleCreateTaskFromColumn}
                                  projectsMap={projectsMap}
                                  showProjectDot={selectedProjectId === null}
                                  disableDrag={filter.groupBy === 'due_date'}
                                  taskTags={taskTags}
                                  tags={tags}
                                  blockedTaskIds={blockedTaskIds}
                                  allProjects={projects}
                                  onUpdateTask={contextMenuUpdate}
                                  onArchiveTask={archiveTask}
                                  onDeleteTask={deleteTask}
                                  onArchiveAllTasks={archiveTasks}
                                />
                              </div>
                            </>
                          )}
                        </div>
                      ) : (
                        <TaskDetailPage
                          taskId={tab.taskId}
                          isActive={i === activeTabIndex}
                          onBack={goBack}
                          onTaskUpdated={updateTask}
                          onArchiveTask={archiveTask}
                          onDeleteTask={deleteTask}
                          onNavigateToTask={openTask}
                          onConvertTask={handleConvertTask}
                        />
                      )}
                    </div>
                  ))}
                </div>

                {notificationState.isLocked && (
                  <NotificationSidePanel
                    width={notificationState.panelWidth}
                    onWidthChange={(width) => setNotificationState({ panelWidth: width })}
                    attentionTasks={attentionTasks}
                    projects={projects}
                    filterCurrentProject={notificationState.filterCurrentProject}
                    onFilterToggle={() =>
                      setNotificationState({
                        filterCurrentProject: !notificationState.filterCurrentProject
                      })
                    }
                    onNavigate={openTask}
                    onCloseTerminal={async (sessionId) => {
                      await window.api.pty.kill(sessionId)
                      refreshAttentionTasks()
                    }}
                    selectedProjectId={selectedProjectId}
                    currentProjectName={projects.find((p) => p.id === selectedProjectId)?.name}
                  />
                )}
              </div>
        </div>

        {/* Dialogs */}
        <CreateTaskDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={handleTaskCreated}
          onCreatedAndOpen={handleTaskCreatedAndOpen}
          defaultProjectId={selectedProjectId ?? projects[0]?.id}
          defaultStatus={createTaskDefaults.status}
          defaultPriority={createTaskDefaults.priority}
          defaultDueDate={createTaskDefaults.dueDate}
          tags={tags}
          onTagCreated={(tag: Tag) => setTags((prev) => [...prev, tag])}
        />
        <EditTaskDialog
          task={editingTask}
          open={!!editingTask}
          onOpenChange={(open) => !open && setEditingTask(null)}
          onUpdated={handleTaskUpdated}
        />
        <EditTaskDialog
          task={convertingTask}
          open={!!convertingTask}
          onOpenChange={(open) => {
            if (!open) {
              setConvertingTask(null)
              convertResolveRef.current = null
            }
          }}
          onUpdated={handleConvertTaskSaved}
        />
        <DeleteTaskDialog
          task={deletingTask}
          open={!!deletingTask}
          onOpenChange={(open) => !open && setDeletingTask(null)}
          onDeleted={handleTaskDeleted}
        />
        <CreateProjectDialog
          open={createProjectOpen}
          onOpenChange={setCreateProjectOpen}
          onCreated={handleProjectCreated}
        />
        <ProjectSettingsDialog
          project={editingProject}
          open={!!editingProject}
          onOpenChange={(open) => !open && setEditingProject(null)}
          onUpdated={handleProjectUpdated}
        />
        <DeleteProjectDialog
          project={deletingProject}
          open={!!deletingProject}
          onOpenChange={(open) => !open && setDeletingProject(null)}
          onDeleted={handleProjectDeleted}
        />
        <UserSettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          initialTab={settingsInitialTab}
          onTabChange={setSettingsInitialTab}
        />
        <SearchDialog
          open={searchOpen}
          onOpenChange={setSearchOpen}
          tasks={tasks}
          projects={projects}
          onSelectTask={openTask}
          onSelectProject={setSelectedProjectId}
        />
        <OnboardingDialog
          externalOpen={onboardingOpen}
          onExternalClose={() => setOnboardingOpen(false)}
        />
        <AlertDialog open={completeTaskDialogOpen} onOpenChange={setCompleteTaskDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Complete Task</AlertDialogTitle>
              <AlertDialogDescription>Mark as done and close tab?</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction autoFocus onClick={handleCompleteTaskConfirm}>Complete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Toaster position="bottom-right" theme="dark" />
      </div>
    </SidebarProvider>
  )
}

export default App
