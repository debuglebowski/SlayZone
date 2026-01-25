import { useState, useEffect, useRef } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import type { Task, Project, Tag, TaskStatus } from '../../shared/types/database'
import { KanbanBoard } from '@/components/kanban/KanbanBoard'
import { applyFilters, type Column } from '@/lib/kanban'
import { useFilterState } from '@/hooks/useFilterState'
import { useViewState } from '@/hooks/useViewState'
import { FilterBar } from '@/components/filters/FilterBar'
import { CreateTaskDialog } from '@/components/CreateTaskDialog'
import { QuickRunDialog } from '@/components/QuickRunDialog'
import { EditTaskDialog } from '@/components/EditTaskDialog'
import { DeleteTaskDialog } from '@/components/DeleteTaskDialog'
import { CreateProjectDialog } from '@/components/dialogs/CreateProjectDialog'
import { ProjectSettingsDialog } from '@/components/dialogs/ProjectSettingsDialog'
import { DeleteProjectDialog } from '@/components/dialogs/DeleteProjectDialog'
import { UserSettingsDialog } from '@/components/dialogs/UserSettingsDialog'
import { SearchDialog } from '@/components/dialogs/SearchDialog'
import { OnboardingDialog } from '@/components/onboarding/OnboardingDialog'
import { TaskDetailPage } from '@/components/task-detail/TaskDetailPage'
import { Button } from '@/components/ui/button'
import { SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/sidebar/AppSidebar'
import { TabBar } from '@/components/tabs/TabBar'

function App(): React.JSX.Element {
  // Task state
  const [tasks, setTasks] = useState<Task[]>([])

  // Project state
  const [projects, setProjects] = useState<Project[]>([])

  // Tag state
  const [tags, setTags] = useState<Tag[]>([])
  const [taskTags, setTaskTags] = useState<Map<string, string[]>>(new Map())

  // Blocked tasks state
  const [blockedTaskIds, setBlockedTaskIds] = useState<Set<string>>(new Set())

  // View state (tabs + selected project, persisted)
  const [tabs, activeTabIndex, selectedProjectId, setTabs, setActiveTabIndex, setSelectedProjectId] =
    useViewState()

  // Filter state (persisted per project)
  const [filter, setFilter] = useFilterState(selectedProjectId)

  // Open task = add or switch to existing tab
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

  // Open task in background (add tab without switching)
  const openTaskInBackground = (taskId: string): void => {
    const existing = tabs.findIndex((t) => t.type === 'task' && t.taskId === taskId)
    if (existing < 0) {
      const task = tasks.find((t) => t.id === taskId)
      const title = task?.title || 'Task'
      const status = task?.status
      setTabs([...tabs, { type: 'task', taskId, title, status }])
    }
  }

  // Close tab
  const closeTab = (index: number): void => {
    if (index === 0) return // Home can't be closed via UI
    const newTabs = tabs.filter((_, i) => i !== index)
    setTabs(newTabs)
    if (activeTabIndex >= index) {
      setActiveTabIndex(Math.max(0, activeTabIndex - 1))
    }
  }

  // Go back from task detail (close tab)
  const goBack = (): void => {
    if (activeTabIndex > 0) {
      closeTab(activeTabIndex)
    }
  }

  // Sync tab titles/status and remove tabs for deleted tasks
  useEffect(() => {
    const taskIds = new Set(tasks.map((t) => t.id))
    setTabs((prev) => {
      const filtered = prev.filter((tab) => tab.type === 'home' || taskIds.has(tab.taskId))
      // Adjust activeTabIndex if needed
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

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false)
  const [createTaskDefaults, setCreateTaskDefaults] = useState<{
    status?: Task['status']
    priority?: number
    dueDate?: string | null
  }>({})
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [deletingTask, setDeletingTask] = useState<Task | null>(null)

  // Project dialog state
  const [createProjectOpen, setCreateProjectOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [deletingProject, setDeletingProject] = useState<Project | null>(null)

  // Settings dialog state
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Onboarding dialog state (for manual trigger via Tutorial)
  const [onboardingOpen, setOnboardingOpen] = useState(false)

  // Search dialog state
  const [searchOpen, setSearchOpen] = useState(false)

  // Quick run dialog state
  const [quickRunOpen, setQuickRunOpen] = useState(false)

  // Inline project rename state
  const [projectNameValue, setProjectNameValue] = useState('')
  const projectNameInputRef = useRef<HTMLTextAreaElement>(null)

  // Load data on mount
  useEffect(() => {
    Promise.all([
      window.api.db.getTasks(),
      window.api.db.getProjects(),
      window.api.tags.getTags()
    ]).then(([t, p, tg]) => {
      setTasks(t as Task[])
      setProjects(p as Project[])
      setTags(tg as Tag[])
      // Load task tags mapping
      loadTaskTags(t as Task[])
      // Load blocked task IDs
      loadBlockedTaskIds(t as Task[])
    })
  }, [])

  // Load task tags mapping for all tasks
  const loadTaskTags = async (taskList: Task[]): Promise<void> => {
    const mapping = new Map<string, string[]>()
    await Promise.all(
      taskList.map(async (task) => {
        const tags = await window.api.taskTags.getTagsForTask(task.id)
        mapping.set(
          task.id,
          tags.map((t) => t.id)
        )
      })
    )
    setTaskTags(mapping)
  }

  // Load blocked task IDs for all tasks
  const loadBlockedTaskIds = async (taskList: Task[]): Promise<void> => {
    const blocked = new Set<string>()
    await Promise.all(
      taskList.map(async (task) => {
        const blockers = await window.api.taskDependencies.getBlockers(task.id)
        if (blockers.length > 0) {
          blocked.add(task.id)
        }
      })
    )
    setBlockedTaskIds(blocked)
  }

  // Filter tasks based on selected project
  const projectTasks = selectedProjectId
    ? tasks.filter((t) => t.project_id === selectedProjectId)
    : tasks


  // Sync project name value when selected project changes
  useEffect(() => {
    if (selectedProjectId) {
      const project = projects.find((p) => p.id === selectedProjectId)
      if (project) {
        setProjectNameValue(project.name)
      }
    }
  }, [selectedProjectId, projects])

  // Auto-resize textarea to fit content
  useEffect(() => {
    if (projectNameInputRef.current) {
      projectNameInputRef.current.style.height = 'auto'
      projectNameInputRef.current.style.height = `${projectNameInputRef.current.scrollHeight}px`
    }
  }, [projectNameValue])

  // Apply filter state
  const displayTasks = applyFilters(projectTasks, filter, taskTags)

  // Create projects map for card lookups
  const projectsMap = new Map(projects.map((p) => [p.id, p]))

  // Navigation handlers
  const openTaskDetail = (taskId: string): void => {
    openTask(taskId)
  }

  // Keyboard shortcuts
  // "mod+n" opens new task dialog from anywhere
  useHotkeys(
    'mod+n',
    (e) => {
      if (projects.length > 0) {
        e.preventDefault()
        setCreateOpen(true)
      }
    },
    { enableOnFormTags: true }
  )

  // "mod+shift+n" opens quick run dialog
  useHotkeys(
    'mod+shift+n',
    (e) => {
      if (projects.length > 0) {
        e.preventDefault()
        setQuickRunOpen(true)
      }
    },
    { enableOnFormTags: true }
  )

  // "mod+k" opens search dialog from anywhere
  useHotkeys(
    'mod+k',
    (e) => {
      e.preventDefault()
      setSearchOpen(true)
    },
    { enableOnFormTags: true }
  )

  // "mod+w" closes current tab or window
  useHotkeys(
    'mod+w',
    (e) => {
      e.preventDefault()
      if (activeTabIndex === 0) {
        window.api.window.close()
      } else {
        closeTab(activeTabIndex)
      }
    },
    { enableOnFormTags: true }
  )

  // "mod+§" switches to home/kanban tab (intercepted at Electron level)
  useEffect(() => {
    return window.api.app.onGoHome(() => setActiveTabIndex(0))
  }, [])

  // "mod+1-9" switches to task tabs (1 = first task tab, not home)
  useHotkeys(
    'mod+1,mod+2,mod+3,mod+4,mod+5,mod+6,mod+7,mod+8,mod+9',
    (e) => {
      e.preventDefault()
      const key = e.key
      const num = parseInt(key, 10)
      // num maps to task tab index (1 = index 1, etc.)
      if (num < tabs.length) setActiveTabIndex(num)
    },
    { enableOnFormTags: true }
  )

  // "ctrl+tab" cycles to next tab (wraps around)
  useHotkeys(
    'ctrl+tab',
    (e) => {
      e.preventDefault()
      setActiveTabIndex((prev) => (prev + 1) % tabs.length)
    },
    { enableOnFormTags: true }
  )

  // "ctrl+shift+tab" cycles to previous tab (wraps around)
  useHotkeys(
    'ctrl+shift+tab',
    (e) => {
      e.preventDefault()
      setActiveTabIndex((prev) => (prev - 1 + tabs.length) % tabs.length)
    },
    { enableOnFormTags: true }
  )

  // CRUD handlers
  const handleTaskCreated = (task: Task): void => {
    setTasks([task, ...tasks])
    setCreateOpen(false)
    setCreateTaskDefaults({})
  }

  const handleQuickRunCreated = (task: Task): void => {
    setTasks([task, ...tasks])
    setQuickRunOpen(false)
    openTask(task.id)
  }

  const handleCreateTaskFromColumn = (column: Column): void => {
    const defaults: {
      status?: Task['status']
      priority?: number
      dueDate?: string | null
    } = {}

    if (filter.groupBy === 'status') {
      // Column id is the status
      defaults.status = column.id as Task['status']
    } else if (filter.groupBy === 'priority') {
      // Column id is like "p1", "p2", etc.
      const priority = parseInt(column.id.slice(1), 10)
      if (!isNaN(priority)) {
        defaults.priority = priority
      }
    } else if (filter.groupBy === 'due_date') {
      // Column id is like "today", "this_week", etc.
      const today = new Date().toISOString().split('T')[0]
      if (column.id === 'today') {
        defaults.dueDate = today
      } else if (column.id === 'this_week') {
        const weekEnd = new Date(today)
        weekEnd.setDate(weekEnd.getDate() + 7)
        defaults.dueDate = weekEnd.toISOString().split('T')[0]
      } else if (column.id === 'overdue') {
        // For overdue, set to yesterday
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        defaults.dueDate = yesterday.toISOString().split('T')[0]
      }
      // "later" and "no_date" don't set a default due date
    }

    setCreateTaskDefaults(defaults)
    setCreateOpen(true)
  }

  const handleTaskUpdated = (task: Task): void => {
    setTasks(tasks.map((t) => (t.id === task.id ? task : t)))
    setEditingTask(null)
  }

  // Handler for task detail page updates (doesn't close dialog)
  const handleTaskDetailUpdated = (task: Task): void => {
    setTasks(tasks.map((t) => (t.id === task.id ? task : t)))
  }

  const handleTaskMove = (taskId: string, newColumnId: string, targetIndex: number): void => {
    // due_date grouping: drag disabled
    if (filter.groupBy === 'due_date') return

    // Compute field update based on groupBy
    const fieldUpdate =
      filter.groupBy === 'status'
        ? { status: newColumnId as TaskStatus }
        : { priority: parseInt(newColumnId.slice(1), 10) }

    // Get tasks in target column (after applying the field update)
    const targetColumnTasks = tasks.filter((t) => {
      if (t.id === taskId) return false // Exclude the moving task
      if (filter.groupBy === 'status') return t.status === newColumnId
      return t.priority === parseInt(newColumnId.slice(1), 10)
    })

    // Insert the moved task at target position
    const movedTask = tasks.find((t) => t.id === taskId)
    if (!movedTask) return

    const newColumnTaskIds = [...targetColumnTasks.map((t) => t.id)]
    newColumnTaskIds.splice(targetIndex, 0, taskId)

    // Optimistic update: update field + reorder
    const previousTasks = tasks
    setTasks(
      tasks.map((t) => {
        if (t.id === taskId) {
          return { ...t, ...fieldUpdate, order: targetIndex }
        }
        const newOrder = newColumnTaskIds.indexOf(t.id)
        if (newOrder >= 0) {
          return { ...t, order: newOrder }
        }
        return t
      })
    )

    // Async DB calls with rollback
    const updatePayload =
      filter.groupBy === 'status'
        ? { id: taskId, status: newColumnId as TaskStatus }
        : { id: taskId, priority: parseInt(newColumnId.slice(1), 10) }

    Promise.all([
      window.api.db.updateTask(updatePayload),
      window.api.db.reorderTasks(newColumnTaskIds)
    ]).catch(() => {
      setTasks(previousTasks)
    })
  }

  const handleTaskReorder = (taskIds: string[]): void => {
    // Optimistic update
    const previousTasks = tasks
    setTasks(
      tasks.map((t) => {
        const newOrder = taskIds.indexOf(t.id)
        if (newOrder >= 0) {
          return { ...t, order: newOrder }
        }
        return t
      })
    )

    // Async DB call with rollback
    window.api.db.reorderTasks(taskIds).catch(() => {
      setTasks(previousTasks)
    })
  }

  const handleTaskDeleted = (): void => {
    if (deletingTask) {
      setTasks(tasks.filter((t) => t.id !== deletingTask.id))
      setDeletingTask(null)
    }
  }

  // Handle task click - navigate to detail page (or open in background with Cmd)
  const handleTaskClick = (task: Task, e: React.MouseEvent): void => {
    if (e.metaKey) {
      openTaskInBackground(task.id)
    } else {
      openTaskDetail(task.id)
    }
  }

  // Context menu handlers
  const handleContextMenuUpdate = async (
    taskId: string,
    updates: Partial<Task>
  ): Promise<void> => {
    // Optimistic update
    const previousTasks = tasks
    setTasks(tasks.map((t) => (t.id === taskId ? { ...t, ...updates } : t)))

    try {
      await window.api.db.updateTask({
        id: taskId,
        status: updates.status,
        priority: updates.priority,
        projectId: updates.project_id
      })
    } catch {
      setTasks(previousTasks)
    }
  }

  const handleContextMenuArchive = async (taskId: string): Promise<void> => {
    setTasks(tasks.filter((t) => t.id !== taskId))
    await window.api.db.archiveTask(taskId)
  }

  const handleContextMenuDelete = async (taskId: string): Promise<void> => {
    setTasks(tasks.filter((t) => t.id !== taskId))
    await window.api.db.deleteTask(taskId)
  }

  // Project CRUD handlers
  const handleProjectCreated = (project: Project): void => {
    setProjects([...projects, project])
    setSelectedProjectId(project.id)
    setCreateProjectOpen(false)
  }

  const handleProjectUpdated = (project: Project): void => {
    setProjects(projects.map((p) => (p.id === project.id ? project : p)))
    setEditingProject(null)
  }

  const handleProjectNameSave = async (): Promise<void> => {
    if (!selectedProjectId) return
    const trimmed = projectNameValue.trim()
    if (!trimmed) {
      // Restore original name if empty
      const project = projects.find((p) => p.id === selectedProjectId)
      if (project) {
        setProjectNameValue(project.name)
      }
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
        setProjects(projects.map((p) => (p.id === selectedProjectId ? updated : p)))
      } catch (error) {
        // Restore original name on error
        if (project) {
          setProjectNameValue(project.name)
        }
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
      if (project) {
        setProjectNameValue(project.name)
      }
      projectNameInputRef.current?.blur()
    }
  }

  const handleProjectDeleted = (): void => {
    if (deletingProject) {
      const remaining = projects.filter((p) => p.id !== deletingProject.id)
      setProjects(remaining)
      // Also remove tasks belonging to deleted project
      setTasks(tasks.filter((t) => t.project_id !== deletingProject.id))
      if (selectedProjectId === deletingProject.id) {
        setSelectedProjectId(remaining.length > 0 ? remaining[0].id : null)
      }
      setDeletingProject(null)
    }
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="h-full w-full flex">
        {/* Sidebar - full height */}
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

        {/* Right side - TabBar + content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top drag region + Tab Bar */}
          <div className="window-drag-region pt-2">
            <div className="window-no-drag">
              <TabBar
                tabs={tabs}
                activeIndex={activeTabIndex}
                onTabClick={setActiveTabIndex}
                onTabClose={closeTab}
              />
            </div>
          </div>

          {/* Tab Content - all tabs rendered, inactive hidden */}
          <div className="flex-1 min-h-0 relative">
            {tabs.map((tab, i) => (
              <div
                key={tab.type === 'home' ? 'home' : tab.taskId}
                className={`absolute inset-0 ${i !== activeTabIndex ? 'hidden' : ''}`}
              >
                {tab.type === 'home' ? (
                  renderHomeTab()
                ) : (
                  <TaskDetailPage
                    taskId={tab.taskId}
                    onBack={goBack}
                    onTaskUpdated={handleTaskDetailUpdated}
                    onNavigateToTask={openTaskDetail}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* All Dialogs */}
        <CreateTaskDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={handleTaskCreated}
          defaultProjectId={selectedProjectId ?? projects[0]?.id}
          defaultStatus={createTaskDefaults.status}
          defaultPriority={createTaskDefaults.priority}
          defaultDueDate={createTaskDefaults.dueDate}
          tags={tags}
          onTagCreated={(tag) => setTags([...tags, tag])}
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
          onSelectTask={openTaskDetail}
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
      </div>
    </SidebarProvider>
  )

  function renderHomeTab(): React.JSX.Element {
    return (
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
                onTaskReorder={handleTaskReorder}
                onTaskClick={handleTaskClick}
                onCreateTask={handleCreateTaskFromColumn}
                projectsMap={projectsMap}
                showProjectDot={selectedProjectId === null}
                disableDrag={filter.groupBy === 'due_date'}
                taskTags={taskTags}
                tags={tags}
                blockedTaskIds={blockedTaskIds}
                allProjects={projects}
                onUpdateTask={handleContextMenuUpdate}
                onArchiveTask={handleContextMenuArchive}
                onDeleteTask={handleContextMenuDelete}
              />
            </div>
          </>
        )}
      </div>
    )
  }
}

export default App
