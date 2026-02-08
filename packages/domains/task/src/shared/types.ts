import type { TerminalMode } from '@slayzone/terminal/shared'
import type { BrowserTabsState } from '@slayzone/task-browser/shared'

export type TaskStatus = 'inbox' | 'backlog' | 'todo' | 'in_progress' | 'review' | 'done'
export type MergeState = 'uncommitted' | 'conflicts'

export interface PanelVisibility {
  terminal: boolean
  browser: boolean
  gitDiff: boolean
  settings: boolean
}

export interface Task {
  id: string
  project_id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: number // 1-5, default 3
  order: number
  due_date: string | null
  archived_at: string | null
  // Terminal configuration
  terminal_mode: TerminalMode
  claude_conversation_id: string | null
  codex_conversation_id: string | null
  terminal_shell: string | null
  claude_flags: string
  codex_flags: string
  // Legacy (kept for backwards compat, use claude_conversation_id instead)
  claude_session_id: string | null
  // Permissions
  dangerously_skip_permissions: boolean
  // Panel visibility (JSON)
  panel_visibility: PanelVisibility | null
  // Worktree
  worktree_path: string | null
  worktree_parent_branch: string | null
  browser_url: string | null
  // Browser tabs (JSON)
  browser_tabs: BrowserTabsState | null
  // Merge mode
  merge_state: MergeState | null
  created_at: string
  updated_at: string
}

export interface TaskDependency {
  task_id: string
  blocks_task_id: string
}

export interface CreateTaskInput {
  projectId: string
  title: string
  description?: string
  status?: string
  priority?: number
  dueDate?: string
  terminalMode?: TerminalMode
  claudeFlags?: string
  codexFlags?: string
}

export interface UpdateTaskInput {
  id: string
  title?: string
  description?: string | null
  status?: TaskStatus
  priority?: number
  dueDate?: string | null
  projectId?: string
  // Terminal config
  terminalMode?: TerminalMode
  claudeConversationId?: string | null
  codexConversationId?: string | null
  terminalShell?: string | null
  claudeFlags?: string
  codexFlags?: string
  // Panel visibility
  panelVisibility?: PanelVisibility | null
  // Worktree
  worktreePath?: string | null
  worktreeParentBranch?: string | null
  browserUrl?: string | null
  // Browser tabs
  browserTabs?: BrowserTabsState | null
  // Merge mode
  mergeState?: MergeState | null
  // Legacy
  claudeSessionId?: string | null
}

// AI description generation result
export interface GenerateDescriptionResult {
  success: boolean
  description?: string
  error?: string
}
