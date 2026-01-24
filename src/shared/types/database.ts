export type TaskStatus = 'inbox' | 'backlog' | 'todo' | 'in_progress' | 'review' | 'done'
export type TerminalMode = 'claude-code' | 'codex' | 'terminal'

export interface Task {
  id: string
  project_id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: number // 1-5, default 3
  due_date: string | null
  archived_at: string | null
  // Terminal configuration
  terminal_mode: TerminalMode
  claude_conversation_id: string | null
  codex_conversation_id: string | null
  terminal_shell: string | null
  // Legacy (kept for backwards compat, use claude_conversation_id instead)
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
