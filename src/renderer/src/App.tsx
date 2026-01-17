import { useState, useEffect } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import type { Task, Project, Tag, TaskStatus } from '../../shared/types/database'
import { KanbanBoard } from '@/components/kanban/KanbanBoard'
import { applyFilters } from '@/lib/kanban'
import { useFilterState } from '@/hooks/useFilterState'
import { FilterBar } from '@/components/filters/FilterBar'
import { CreateTaskDialog } from '@/components/CreateTaskDialog'
import { EditTaskDialog } from '@/components/EditTaskDialog'
import { DeleteTaskDialog } from '@/components/DeleteTaskDialog'
import { CreateProjectDialog } from '@/components/dialogs/CreateProjectDialog'
import { ProjectSettingsDialog } from '@/components/dialogs/ProjectSettingsDialog'
import { DeleteProjectDialog } from '@/components/dialogs/DeleteProjectDialog'
import { UserSettingsDialog } from '@/components/dialogs/UserSettingsDialog'
import { OnboardingDialog } from '@/components/onboarding/OnboardingDialog'
import { TaskDetailPage } from '@/components/task-detail/TaskDetailPage'
import { WorkModePage } from '@/components/work-mode/WorkModePage'
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
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [deletingTask, setDeletingTask] = useState<Task | null>(null)

  // Project dialog state
  const [createProjectOpen, setCreateProjectOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [deletingProject, setDeletingProject] = useState<Project | null>(null)

  // Settings dialog state
  const [settingsOpen, setSettingsOpen] = useState(false)

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
        mapping.set(task.id, tags.map((t) => t.id))
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

  // Keyboard shortcuts
  // "n" opens new task dialog (only from kanban view, when no dialog open)
  useHotkeys('n', () => {
    if (projects.length > 0 && view.type === 'kanban') {
      setCreateOpen(true)
    }
  }, { enableOnFormTags: false })

  // "esc" navigates back (Radix handles dialog closing)
  useHotkeys('escape', () => {
    // Skip if any dialog is open - Radix handles those
    if (createOpen || editingTask || deletingTask) return
    if (createProjectOpen || editingProject || deletingProject) return
    if (settingsOpen) return

    // Navigate back
    if (view.type === 'work-mode') closeWorkMode()
    else if (view.type === 'task-detail') closeTaskDetail()
  }, { enableOnFormTags: false })

  // CRUD handlers
  const handleTaskCreated = (task: Task): void => {
    setTasks([task, ...tasks])
    setCreateOpen(false)
  }

  const handleTaskUpdated = (task: Task): void => {
    setTasks(tasks.map((t) => (t.id === task.id ? task : t)))
    setEditingTask(null)
  }

  // Handler for task detail page updates (doesn't close dialog)
  const handleTaskDetailUpdated = (task: Task): void => {
    setTasks(tasks.map((t) => (t.id === task.id ? task : t)))
  }

  const handleTaskMove = async (taskId: string, newColumnId: string): Promise<void> => {
    // Status grouping: update status field
    if (filter.groupBy === 'status') {
      const updated = await window.api.db.updateTask({
        id: taskId,
        status: newColumnId as TaskStatus
      })
      if (updated) {
        setTasks(tasks.map((t) => (t.id === taskId ? updated : t)))
      }
    }
    // Priority grouping: update priority field (column id is 'p1', 'p2', etc.)
    else if (filter.groupBy === 'priority') {
      const priority = parseInt(newColumnId.slice(1), 10) // 'p1' -> 1
      const updated = await window.api.db.updateTask({
        id: taskId,
        priority
      })
      if (updated) {
        setTasks(tasks.map((t) => (t.id === taskId ? updated : t)))
      }
    }
    // due_date grouping: drag disabled (dates can't be set by column)
  }

  const handleTaskDeleted = (): void => {
    if (deletingTask) {
      setTasks(tasks.filter((t) => t.id !== deletingTask.id))
      setDeletingTask(null)
    }
  }

  // Handle task click - navigate to detail page
  const handleTaskClick = (task: Task): void => {
    openTaskDetail(task.id)
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
    return (
      <WorkModePage
        taskId={view.taskId}
        onBack={closeWorkMode}
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
      />
      <SidebarInset className="min-h-screen min-w-0">
        <div className="flex flex-col flex-1 p-6">
          <header className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold">
              {selectedProjectId
                ? projects.find(p => p.id === selectedProjectId)?.name ?? 'Focus'
                : 'All Tasks'}
            </h1>
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
                  projectsMap={projectsMap}
                  showProjectDot={selectedProjectId === null}
                  disableDrag={filter.groupBy === 'due_date'}
                />
              </div>
            </>
          )}

          {/* Task Dialogs */}
          <CreateTaskDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            onCreated={handleTaskCreated}
            defaultProjectId={selectedProjectId ?? undefined}
            tags={tags}
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
          <UserSettingsDialog
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
          />

          {/* Onboarding (first launch) */}
          <OnboardingDialog />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default App
