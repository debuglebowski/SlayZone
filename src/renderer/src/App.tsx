import { useState, useEffect } from 'react'
import type { Task, Project } from '../../shared/types/database'
import { TaskList } from '@/components/TaskList'
import { CreateTaskDialog } from '@/components/CreateTaskDialog'
import { EditTaskDialog } from '@/components/EditTaskDialog'
import { DeleteTaskDialog } from '@/components/DeleteTaskDialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
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

  // Quick project create
  const [newProjectName, setNewProjectName] = useState('')
  const [projectDialogOpen, setProjectDialogOpen] = useState(false)

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

  const handleTaskDeleted = (): void => {
    if (deletingTask) {
      setTasks(tasks.filter((t) => t.id !== deletingTask.id))
      setDeletingTask(null)
    }
  }

  const handleCreateProject = async (): Promise<void> => {
    if (!newProjectName.trim()) return
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
    const color = colors[projects.length % colors.length]
    const project = await window.api.db.createProject({ name: newProjectName, color })
    setProjects([...projects, project])
    setSelectedProjectId(project.id)
    setNewProjectName('')
    setProjectDialogOpen(false)
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
        onAddProject={() => setProjectDialogOpen(true)}
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
            <TaskList
              tasks={filteredTasks}
              onEdit={setEditingTask}
              onDelete={setDeletingTask}
            />
          )}

          {/* Dialogs */}
          <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Project</DialogTitle>
              </DialogHeader>
              <div className="flex gap-2">
                <Input
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="Project name"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                />
                <Button onClick={handleCreateProject}>Create</Button>
              </div>
            </DialogContent>
          </Dialog>
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
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default App
