import type { TerminalMode } from '@slayzone/terminal/shared'
import type { BrowserTabsState } from '@slayzone/task-browser/shared'

// keep in sync with TASK_STATUS_ORDER in @slayzone/ui
export const TASK_STATUSES = ['inbox', 'backlog', 'todo', 'in_progress', 'review', 'done'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]
export type MergeState = 'uncommitted' | 'conflicts'

export interface PanelVisibility extends Record<string, boolean> {
  terminal: boolean
  browser: boolean
  diff: boolean
  settings: boolean
  editor: boolean
}

// Web panel definition (custom or predefined)
export interface WebPanelDefinition {
  id: string           // 'web:<uuid>' for custom, 'web:figma' for predefined
  name: string
  baseUrl: string
  shortcut?: string    // single letter, e.g. 'm' → Cmd+M
  predefined?: boolean // true = shipped with app (can still be deleted)
  favicon?: string     // cached favicon URL
}

// Global panel config (stored in settings table as JSON)
export interface PanelConfig {
  builtinEnabled: Record<string, boolean>
  webPanels: WebPanelDefinition[]
  deletedPredefined?: string[] // IDs of predefined panels the user removed
}

// Per-task URL state (panelId → current URL)
export type WebPanelUrls = Record<string, string>

export const BUILTIN_PANEL_IDS = ['terminal', 'browser', 'editor', 'diff', 'settings'] as const

export const PREDEFINED_WEB_PANELS: WebPanelDefinition[] = [
  { id: 'web:figma', name: 'Figma', baseUrl: 'https://figma.com', shortcut: 'i', predefined: true },
  { id: 'web:notion', name: 'Notion', baseUrl: 'https://notion.so', shortcut: 'n', predefined: true },
  { id: 'web:github', name: 'GitHub', baseUrl: 'https://github.com', shortcut: 'h', predefined: true },
  { id: 'web:excalidraw', name: 'Excalidraw', baseUrl: 'https://excalidraw.com', shortcut: 'x', predefined: true }
]

export const DEFAULT_PANEL_CONFIG: PanelConfig = {
  builtinEnabled: Object.fromEntries(BUILTIN_PANEL_IDS.map(id => [id, true])),
  webPanels: [...PREDEFINED_WEB_PANELS]
}

export interface Task {
  id: string
  project_id: string
  parent_id: string | null
  title: string
  description: string | null
  assignee: string | null
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
  // Web panel URLs (JSON) — per-task persistent URLs for custom/predefined web panels
  web_panel_urls: WebPanelUrls | null
  // Merge mode
  merge_state: MergeState | null
  // External link (populated via JOIN)
  linear_url: string | null
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
  assignee?: string | null
  status?: string
  priority?: number
  dueDate?: string
  terminalMode?: TerminalMode
  claudeFlags?: string
  codexFlags?: string
  parentId?: string
}

export interface UpdateTaskInput {
  id: string
  title?: string
  description?: string | null
  assignee?: string | null
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
  // Web panel URLs
  webPanelUrls?: WebPanelUrls | null
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
