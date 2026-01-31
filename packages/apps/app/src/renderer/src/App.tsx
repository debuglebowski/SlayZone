import { useState, useEffect, useRef, useMemo } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import type { Task } from '@omgslayzone/task/shared'
import type { Project } from '@omgslayzone/projects/shared'
import type { Tag } from '@omgslayzone/tags/shared'
// Domains
import { KanbanBoard, FilterBar, useTasksData, useFilterState, applyFilters, type Column } from '@omgslayzone/tasks'
import { CreateTaskDialog, QuickRunDialog, EditTaskDialog, DeleteTaskDialog, TaskDetailPage } from '@omgslayzone/task'
import { CreateProjectDialog, ProjectSettingsDialog, DeleteProjectDialog } from '@omgslayzone/projects'
import { UserSettingsDialog, useViewState } from '@omgslayzone/settings'
import { OnboardingDialog } from '@omgslayzone/onboarding'
import { usePty } from '@omgslayzone/terminal/client'
import type { TerminalState } from '@omgslayzone/terminal/shared'
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
  AlertDialogTitle
} from '@omgslayzone/ui'
import { SidebarProvider } from '@omgslayzone/ui'
import { AppSidebar } from '@/components/sidebar/AppSidebar'
import { TabBar } from '@/components/tabs/TabBar'

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
  const [onboardingOpen, setOnboardingOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [quickRunOpen, setQuickRunOpen] = useState(false)
  const [completeTaskDialogOpen, setCompleteTaskDialogOpen] = useState(false)

  // Inline project rename state
  const [projectNameValue, setProjectNameValue] = useState('')
  const projectNameInputRef = useRef<HTMLTextAreaElement>(null)

  // Terminal state tracking for tab indicators
  const ptyContext = usePty()
  const [terminalStates, setTerminalStates] = useState<Map<string, TerminalState>>(new Map())

  // Get task IDs from open tabs
  const openTaskIds = useMemo(
    () => tabs.filter((t): t is { type: 'task'; taskId: string; title: string } => t.type === 'task').map((t) => t.taskId),
    [tabs]
  )

  // Subscribe to terminal state changes for open tabs
  useEffect(() => {
    const unsubscribes: (() => void)[] = []

    for (const taskId of openTaskIds) {
      // Initialize with current state
      const currentState = ptyContext.getState(taskId)
      setTerminalStates((prev) => {
        const next = new Map(prev)
        next.set(taskId, currentState)
        return next
      })

      // Subscribe to changes
      const unsub = ptyContext.subscribeState(taskId, (newState) => {
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
      setTabs([...tabs, { type: 'task', taskId, title, status }])
      setActiveTabIndex(tabs.length)
    }
  }

  const openTaskInBackground = (taskId: string): void => {
    const existing = tabs.findIndex((t) => t.type === 'task' && t.taskId === taskId)
    if (existing < 0) {
      const task = tasks.find((t) => t.id === taskId)
      const title = task?.title || 'Task'
      const status = task?.status
      setTabs([...tabs, { type: 'task', taskId, title, status }])
    }
  }

  const closeTab = (index: number): void => {
    if (index === 0) return
    const newTabs = tabs.filter((_, i) => i !== index)
    setTabs(newTabs)
    if (activeTabIndex >= index) {
      setActiveTabIndex(Math.max(0, activeTabIndex - 1))
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
      const filtered = prev.filter((tab) => tab.type === 'home' || taskIds.has(tab.taskId))
      if (filtered.length < prev.length) {
        setActiveTabIndex((idx) => Math.min(idx, filtered.length - 1))
      }
      return filtered.map((tab) => {
        if (tab.type !== 'task') return tab
        const task = tasks.find((t) => t.id === tab.taskId)
        if (task && (task.title !== tab.title || task.status !== tab.status)) {
          return { ...tab, title: task.title, status: task.status }
        }
        return tab
      })
    })
  }, [tasks, setTabs, setActiveTabIndex])

  // Sync project name value
  useEffect(() => {
    if (selectedProjectId) {
      const project = projects.find((p) => p.id === selectedProjectId)
      if (project) setProjectNameValue(project.name)
    }
  }, [selectedProjectId, projects])

  // Auto-resize textarea
  useEffect(() => {
    if (projectNameInputRef.current) {
      projectNameInputRef.current.style.height = 'auto'
      projectNameInputRef.current.style.height = `${projectNameInputRef.current.scrollHeight}px`
    }
  }, [projectNameValue])

  // Computed values
  const projectTasks = selectedProjectId
    ? tasks.filter((t) => t.project_id === selectedProjectId)
    : tasks
  const displayTasks = applyFilters(projectTasks, filter, taskTags)
  const projectsMap = new Map(projects.map((p) => [p.id, p]))

  // Keyboard shortcuts
  useHotkeys('mod+n', (e) => {
    if (projects.length > 0) {
      e.preventDefault()
      setCreateOpen(true)
    }
  }, { enableOnFormTags: true })

  useHotkeys('mod+shift+n', (e) => {
    if (projects.length > 0) {
      e.preventDefault()
      setQuickRunOpen(true)
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
    return window.api.app.onGoHome(() => setActiveTabIndex(0))
  }, [])

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

  useHotkeys('mod+shift+d', (e) => {
    e.preventDefault()
    const activeTab = tabs[activeTabIndex]
    if (activeTab.type === 'task') {
      setCompleteTaskDialogOpen(true)
    }
  }, { enableOnFormTags: true })

  const handleCompleteTaskConfirm = async (): Promise<void> => {
    const activeTab = tabs[activeTabIndex]
    if (activeTab.type !== 'task') return

    await window.api.db.updateTask({ id: activeTab.taskId, status: 'done' })
    updateTask({ ...tasks.find((t) => t.id === activeTab.taskId)!, status: 'done' })
    closeTab(activeTabIndex)
    setCompleteTaskDialogOpen(false)
  }

  // Task handlers
  const handleTaskCreated = (task: Task): void => {
    setTasks((prev) => [task, ...prev])
    setCreateOpen(false)
    setCreateTaskDefaults({})
  }

  const handleQuickRunCreated = (task: Task): void => {
    setTasks((prev) => [task, ...prev])
    setQuickRunOpen(false)
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

  const handleTaskDeleted = (): void => {
    if (deletingTask) {
      deleteTask(deletingTask.id)
      setDeletingTask(null)
    }
  }

  const handleTaskClick = (task: Task, e: React.MouseEvent): void => {
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

  const handleProjectDeleted = (): void => {
    if (deletingProject) {
      deleteProject(deletingProject.id, selectedProjectId, setSelectedProjectId)
      setDeletingProject(null)
    }
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="h-full w-full flex">
        <AppSidebar
          projects={projects}
          tasks={tasks}
          selectedProjectId={selectedProjectId}
          onSelectProject={setSelectedProjectId}
          onAddProject={() => setCreateProjectOpen(true)}
          onProjectSettings={setEditingProject}
          onProjectDelete={setDeletingProject}
          onSettings={() => setSettingsOpen(true)}
          onTutorial={() => setOnboardingOpen(true)}
        />

        <div className="flex-1 flex flex-col min-w-0">
          <div className="window-drag-region pt-2">
            <div className="window-no-drag">
              <TabBar
                tabs={tabs}
                activeIndex={activeTabIndex}
                terminalStates={terminalStates}
                onTabClick={setActiveTabIndex}
                onTabClose={closeTab}
                onTabReorder={reorderTabs}
              />
            </div>
          </div>

          <div className="flex-1 min-h-0 relative">
            {tabs.map((tab, i) => (
              <div
                key={tab.type === 'home' ? 'home' : tab.taskId}
                className={`absolute inset-0 ${i !== activeTabIndex ? 'hidden' : ''}`}
              >
                {tab.type === 'home' ? (
                  <div className="flex flex-col flex-1 p-6 pt-4 h-full">
                    <header className="mb-6 flex items-center justify-between window-no-drag">
                      {selectedProjectId ? (
                        <textarea
                          ref={projectNameInputRef}
                          value={projectNameValue}
                          onChange={(e) => setProjectNameValue(e.target.value)}
                          onBlur={handleProjectNameSave}
                          onKeyDown={handleProjectNameKeyDown}
                          className="text-2xl font-bold bg-transparent border-none outline-none w-full resize-none cursor-text"
                          style={{ caretColor: 'currentColor' }}
                          rows={1}
                        />
                      ) : (
                        <h1 className="text-2xl font-bold">All Tasks</h1>
                      )}
                      <Button onClick={() => setCreateOpen(true)} disabled={projects.length === 0}>
                        New Task
                      </Button>
                    </header>

                    {projects.length === 0 ? (
                      <div className="text-center text-muted-foreground">
                        Click + in sidebar to create a project
                      </div>
                    ) : (
                      <>
                        <div className="mb-4">
                          <FilterBar filter={filter} onChange={setFilter} tags={tags} />
                        </div>
                        <div className="flex-1 min-h-0">
                          <KanbanBoard
                            tasks={displayTasks}
                            groupBy={filter.groupBy}
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
                    onNavigateToTask={openTask}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Dialogs */}
        <CreateTaskDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={handleTaskCreated}
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
        <UserSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
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
        <QuickRunDialog
          open={quickRunOpen}
          onOpenChange={setQuickRunOpen}
          onCreated={handleQuickRunCreated}
          defaultProjectId={selectedProjectId ?? projects[0]?.id}
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
      </div>
    </SidebarProvider>
  )
}

export default App
