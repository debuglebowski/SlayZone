import type { Task, Project, TaskStatus } from './database'

export interface CreateTaskInput {
  projectId: string
  title: string
  description?: string
  status?: string
  priority?: number
  dueDate?: string
}

export interface CreateProjectInput {
  name: string
  color: string
}

export interface UpdateTaskInput {
  id: string
  title?: string
  description?: string | null
  status?: TaskStatus
  priority?: number
  dueDate?: string | null
  blockedReason?: string | null
}

export interface UpdateProjectInput {
  id: string
  name?: string
  color?: string
}

export interface ElectronAPI {
  db: {
    // Projects
    getProjects: () => Promise<Project[]>
    createProject: (data: CreateProjectInput) => Promise<Project>
    updateProject: (data: UpdateProjectInput) => Promise<Project>
    deleteProject: (id: string) => Promise<boolean>

    // Tasks
    getTasks: () => Promise<Task[]>
    getTasksByProject: (projectId: string) => Promise<Task[]>
    getTask: (id: string) => Promise<Task | null>
    createTask: (data: CreateTaskInput) => Promise<Task>
    updateTask: (data: UpdateTaskInput) => Promise<Task>
    deleteTask: (id: string) => Promise<boolean>
  }
}
