export type TaskStatus = 'inbox' | 'backlog' | 'todo' | 'in_progress' | 'review' | 'done'

export type RecurrenceType = 'daily' | 'weekly' | 'monthly'

export interface Task {
  id: string
  project_id: string
  parent_id: string | null
  title: string
  description: string | null
  status: TaskStatus
  priority: number // 1-5, default 3
  due_date: string | null
  blocked_reason: string | null
  archived_at: string | null
  recurrence_type: RecurrenceType | null
  recurrence_interval: number | null
  last_reset_at: string | null
  next_reset_at: string | null
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  name: string
  color: string
  created_at: string
  updated_at: string
}

export interface Tag {
  id: string
  name: string
  color: string
  created_at: string
}

export type WorkspaceItemType = 'chat' | 'browser' | 'document' | 'dumper'

export interface WorkspaceItem {
  id: string
  task_id: string
  type: WorkspaceItemType
  name: string
  content: string | null
  url: string | null
  created_at: string
  updated_at: string
}

export type ChatMessageRole = 'user' | 'assistant'

export interface ChatMessage {
  id: string
  workspace_item_id: string
  role: ChatMessageRole
  content: string
  created_at: string
}
