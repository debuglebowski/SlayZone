import { useState, useEffect, useRef } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import type { Task, Project, Tag, TaskStatus } from '../../shared/types/database'
import { KanbanBoard } from '@/components/kanban/KanbanBoard'
import { applyFilters, type Column } from '@/lib/kanban'
import { useFilterState } from '@/hooks/useFilterState'
import { FilterBar } from '@/components/filters/FilterBar'
import { CreateTaskDialog } from '@/components/CreateTaskDialog'
import { EditTaskDialog } from '@/components/EditTaskDialog'
import { DeleteTaskDialog } from '@/components/DeleteTaskDialog'
import { CreateProjectDialog } from '@/components/dialogs/CreateProjectDialog'
import { ProjectSettingsDialog } from '@/components/dialogs/ProjectSettingsDialog'
import { DeleteProjectDialog } from '@/components/dialogs/DeleteProjectDialog'
import { UserSettingsDialog } from '@/components/dialogs/UserSettingsDialog'
import { SearchDialog } from '@/components/dialogs/SearchDialog'
import { OnboardingDialog } from '@/components/onboarding/OnboardingDialog'
import { TaskDetailPage } from '@/components/task-detail/TaskDetailPage'
import { WorkModePage } from '@/components/work-mode/WorkModePage'
import { ArchivedTasksView } from '@/components/ArchivedTasksView'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/sidebar/AppSidebar'
import { useWhatNext } from '@/hooks/useWhatNext'

// View state for navigation
type ViewState =
  | { type: 'kanban' }
  | { type: 'task-detail'; taskId: string }
  | { type: 'work-mode'; taskId: string }
  | { type: 'archived' }

function App(): React.JSX.Element {
  // Task state
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  // Project state
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)

  // Tag state
  const [tags, setTags] = useState<Tag[]>([])
  const [taskTags, setTaskTags] = useState<Map<string, string[]>>(new Map())

  // Filter state (persisted per project)
  const [filter, setFilter, filterLoaded] = useFilterState(selectedProjectId)

  // View state (replaces editingTask for task detail navigation)
  const [view, setView] = useState<ViewState>({ type: 'kanban' })

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
      setTasks(t)
      setProjects(p)
      setTags(tg)
      // Load task tags mapping
      loadTaskTags(t)
      // Don't auto-select first project - start with "All" view
      setLoading(false)
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

  // Filter tasks based on selected project
  const projectTasks = selectedProjectId
    ? tasks.filter((t) => t.project_id === selectedProjectId)
    : tasks

  // Get highest-priority task suggestion
  const whatNextTask = useWhatNext(projectTasks)

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
    setView({ type: 'task-detail', taskId })
  }

  const closeTaskDetail = (): void => {
    setView({ type: 'kanban' })
  }

  const openWorkMode = (taskId: string): void => {
    setView({ type: 'work-mode', taskId })
  }

  const closeWorkMode = (): void => {
    // Return to task detail, not kanban
    if (view.type === 'work-mode') {
      setView({ type: 'task-detail', taskId: view.taskId })
    }
  }

  const openArchive = (): void => {
    setSelectedProjectId(null)
    setView({ type: 'archived' })
  }

  // Keyboard shortcuts
  // "n" opens new task dialog (only from kanban view, when no dialog open)
  useHotkeys(
    'n',
    (e) => {
      if (projects.length > 0 && view.type === 'kanban') {
        e.preventDefault()
        setCreateOpen(true)
      }
    },
    { enableOnFormTags: false }
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

  // "esc" navigates back (Radix handles dialog closing)
  useHotkeys(
    'escape',
    () => {
      // Skip if any dialog is open - Radix handles those
      if (createOpen || editingTask || deletingTask) return
      if (createProjectOpen || editingProject || deletingProject) return
      if (settingsOpen) return
      if (searchOpen) return

      // Navigate back
      if (view.type === 'work-mode') closeWorkMode()
      else if (view.type === 'task-detail') closeTaskDetail()
    },
    { enableOnFormTags: false }
  )

  // CRUD handlers
  const handleTaskCreated = (task: Task): void => {
    setTasks([task, ...tasks])
    setCreateOpen(false)
    setCreateTaskDefaults({})
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

  const handleTaskMove = (taskId: string, newColumnId: string): void => {
    // due_date grouping: drag disabled
    if (filter.groupBy === 'due_date') return

    // Compute optimistic task
    const optimisticTask = (t: Task): Task => {
      if (t.id !== taskId) return t
      if (filter.groupBy === 'status') return { ...t, status: newColumnId as TaskStatus }
      if (filter.groupBy === 'priority')
        return { ...t, priority: parseInt(newColumnId.slice(1), 10) }
      return t
    }

    // Optimistic update
    const previousTasks = tasks
    setTasks(tasks.map(optimisticTask))

    // Async DB call with rollback
    const updatePayload =
      filter.groupBy === 'status'
        ? { id: taskId, status: newColumnId as TaskStatus }
        : { id: taskId, priority: parseInt(newColumnId.slice(1), 10) }

    window.api.db.updateTask(updatePayload).catch(() => {
      setTasks(previousTasks)
    })
  }

  const handleTaskDeleted = (): void => {
    if (deletingTask) {
      setTasks(tasks.filter((t) => t.id !== deletingTask.id))
      setDeletingTask(null)
    }
  }

  // Handle task click - navigate to detail page or work mode based on modifier key
  const handleTaskClick = (task: Task, e: React.MouseEvent): void => {
    if (e.metaKey || e.ctrlKey) {
      openWorkMode(task.id)
    } else {
      openTaskDetail(task.id)
    }
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

  if (loading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>
  }

  // Work Mode view
  if (view.type === 'work-mode') {
    return <WorkModePage taskId={view.taskId} onBack={closeWorkMode} />
  }

  // Archived view (full screen, no sidebar)
  if (view.type === 'archived') {
    return (
      <ArchivedTasksView
        onBack={() => setView({ type: 'kanban' })}
        onTaskClick={(id) => setView({ type: 'task-detail', taskId: id })}
      />
    )
  }

  // Task detail view (full screen, no sidebar)
  if (view.type === 'task-detail') {
    return (
      <TaskDetailPage
        taskId={view.taskId}
        onBack={closeTaskDetail}
        onTaskUpdated={handleTaskDetailUpdated}
        onWorkMode={() => openWorkMode(view.taskId)}
        onNavigateToTask={openTaskDetail}
      />
    )
  }

  // Kanban view (with sidebar)
  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar
        projects={projects}
        selectedProjectId={selectedProjectId}
        onSelectProject={setSelectedProjectId}
        onAddProject={() => setCreateProjectOpen(true)}
        onProjectSettings={setEditingProject}
        onProjectDelete={setDeletingProject}
        onSettings={() => setSettingsOpen(true)}
        onTutorial={() => setOnboardingOpen(true)}
      />
      <SidebarInset className="min-h-screen min-w-0">
        <div className="flex flex-col flex-1 p-6">
          <header className="mb-6 flex items-center justify-between">
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
            <div className="flex items-center gap-3">
              {whatNextTask && (
                <div
                  className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md cursor-pointer hover:bg-muted/80"
                  onClick={() => openTaskDetail(whatNextTask.id)}
                >
                  <span className="text-sm text-muted-foreground">Next:</span>
                  <span className="text-sm font-medium truncate max-w-[200px]">
                    {whatNextTask.title}
                  </span>
                </div>
              )}
              <Button onClick={() => setCreateOpen(true)} disabled={projects.length === 0}>
                New Task
              </Button>
            </div>
          </header>

          {projects.length === 0 ? (
            <div className="text-center text-muted-foreground">
              Click + in sidebar to create a project
            </div>
          ) : (
            <>
              {!filterLoaded ? (
                <Skeleton className="h-10 w-full mb-4" />
              ) : (
                <div className="mb-4">
                  <FilterBar filter={filter} onChange={setFilter} tags={tags} />
                </div>
              )}
              <div className="flex-1 min-h-0">
                <KanbanBoard
                  tasks={displayTasks}
                  groupBy={filter.groupBy}
                  onTaskMove={handleTaskMove}
                  onTaskClick={handleTaskClick}
                  onCreateTask={handleCreateTaskFromColumn}
                  projectsMap={projectsMap}
                  showProjectDot={selectedProjectId === null}
                  disableDrag={filter.groupBy === 'due_date'}
                  taskTags={taskTags}
                  allTasks={projectTasks}
                  tags={tags}
                />
              </div>
            </>
          )}

          {/* Task Dialogs */}
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

          {/* Project Dialogs */}
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

          {/* User Settings Dialog */}
          <UserSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

          {/* Search Dialog */}
          <SearchDialog
            open={searchOpen}
            onOpenChange={setSearchOpen}
            tasks={tasks}
            projects={projects}
            onSelectTask={openTaskDetail}
            onSelectProject={setSelectedProjectId}
          />

          {/* Onboarding (first launch or manual trigger) */}
          <OnboardingDialog
            externalOpen={onboardingOpen}
            onExternalClose={() => setOnboardingOpen(false)}
          />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default App
