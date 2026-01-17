import { useState, useEffect } from 'react'
import type { Task, Project, TaskStatus } from '../../shared/types/database'
import { KanbanBoard } from '@/components/kanban/KanbanBoard'
import type { GroupKey } from '@/lib/kanban'
import { CreateTaskDialog } from '@/components/CreateTaskDialog'
import { EditTaskDialog } from '@/components/EditTaskDialog'
import { DeleteTaskDialog } from '@/components/DeleteTaskDialog'
import { CreateProjectDialog } from '@/components/dialogs/CreateProjectDialog'
import { ProjectSettingsDialog } from '@/components/dialogs/ProjectSettingsDialog'
import { DeleteProjectDialog } from '@/components/dialogs/DeleteProjectDialog'
import { UserSettingsDialog } from '@/components/dialogs/UserSettingsDialog'
import { Button } from '@/components/ui/button'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/sidebar/AppSidebar'

function App(): React.JSX.Element {
  // Task state
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  // Project state
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)

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

  // Kanban state
  const [groupBy] = useState<GroupKey>('status')

  // Load data on mount
  useEffect(() => {
    Promise.all([window.api.db.getTasks(), window.api.db.getProjects()]).then(([t, p]) => {
      setTasks(t)
      setProjects(p)
      // Don't auto-select first project - start with "All" view
      setLoading(false)
    })
  }, [])

  // Filter tasks based on selected project
  const filteredTasks = selectedProjectId
    ? tasks.filter((t) => t.project_id === selectedProjectId)
    : tasks

  // CRUD handlers
  const handleTaskCreated = (task: Task): void => {
    setTasks([task, ...tasks])
    setCreateOpen(false)
  }

  const handleTaskUpdated = (task: Task): void => {
    setTasks(tasks.map((t) => (t.id === task.id ? task : t)))
    setEditingTask(null)
  }

  const handleTaskMove = async (taskId: string, newColumnId: string): Promise<void> => {
    // For status grouping, newColumnId is the status value
    if (groupBy === 'status') {
      const updated = await window.api.db.updateTask({
        id: taskId,
        status: newColumnId as TaskStatus
      })
      if (updated) {
        setTasks(tasks.map((t) => (t.id === taskId ? updated : t)))
      }
    }
    // priority and due_date grouping don't update on drag (read-only columns)
  }

  const handleTaskDeleted = (): void => {
    if (deletingTask) {
      setTasks(tasks.filter((t) => t.id !== deletingTask.id))
      setDeletingTask(null)
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
      <SidebarInset className="min-h-screen">
        <div className="p-6">
          <header className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold">
              {selectedProjectId
                ? projects.find(p => p.id === selectedProjectId)?.name ?? 'Focus'
                : 'All Tasks'}
            </h1>
            <Button onClick={() => setCreateOpen(true)} disabled={projects.length === 0}>
              New Task
            </Button>
          </header>

          {projects.length === 0 ? (
            <div className="text-center text-muted-foreground">
              Click + in sidebar to create a project
            </div>
          ) : (
            <KanbanBoard
              tasks={filteredTasks}
              groupBy={groupBy}
              onTaskMove={handleTaskMove}
              onTaskClick={setEditingTask}
            />
          )}

          {/* Task Dialogs */}
          <CreateTaskDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            onCreated={handleTaskCreated}
            defaultProjectId={selectedProjectId ?? undefined}
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
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default App
