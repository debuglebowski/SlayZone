export type TaskStatus = 'inbox' | 'backlog' | 'todo' | 'in_progress' | 'review' | 'done'

export interface Task {
  id: string
  project_id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: number // 1-5, default 3
  due_date: string | null
  archived_at: string | null
  claude_session_id: string | null
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  name: string
  color: string
  path: string | null
  created_at: string
  updated_at: string
}

export interface TaskDependency {
  task_id: string
  blocks_task_id: string
}

export interface Tag {
  id: string
  name: string
  color: string
  created_at: string
}
