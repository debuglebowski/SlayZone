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
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

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
      if (p.length > 0 && !selectedProjectId) {
        setSelectedProjectId(p[0].id)
      }
      setLoading(false)
    })
  }, [])

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
    <div className="min-h-screen bg-background p-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Focus</h1>
        <div className="flex gap-2">
          <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">New Project</Button>
            </DialogTrigger>
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
          <Button onClick={() => setCreateOpen(true)} disabled={projects.length === 0}>
            New Task
          </Button>
        </div>
      </header>

      {projects.length === 0 ? (
        <div className="text-center text-muted-foreground">Create a project to get started</div>
      ) : (
        <>
          {/* Project tabs */}
          <div className="mb-4 flex gap-2 border-b pb-2">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedProjectId(p.id)}
                className={`flex items-center gap-2 rounded px-3 py-1 ${
                  selectedProjectId === p.id ? 'bg-muted' : 'hover:bg-muted/50'
                }`}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                {p.name}
              </button>
            ))}
          </div>

          {/* Task list */}
          <TaskList
            tasks={tasks.filter((t) => t.project_id === selectedProjectId)}
            onEdit={setEditingTask}
            onDelete={setDeletingTask}
          />
        </>
      )}

      {/* Dialogs */}
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
  )
}

export default App
