import type { Task, Project, Tag, TaskStatus, WorkspaceItem, WorkspaceItemType, RecurrenceType } from './database'

// Theme types
export type Theme = 'light' | 'dark'
export type ThemePreference = 'light' | 'dark' | 'system'

// Claude CLI types
export interface ClaudeAvailability {
  available: boolean
  path: string | null
  version: string | null
}

// Claude streaming types
export interface ClaudeStreamEvent {
  type: 'system' | 'assistant' | 'result' | 'stream_event'
  subtype?: 'init' | 'success' | 'error'
  message?: {
    role: string
    content: Array<{ type: string; text?: string }>
  }
  // stream_event fields (for --include-partial-messages)
  event?: {
    type: string // 'content_block_delta', 'message_start', etc.
    delta?: {
      type: string // 'text_delta'
      text?: string
    }
  }
  session_id?: string
  cost?: number
}

export interface ChatMessage {
  id: string
  workspace_item_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface CreateChatMessageInput {
  workspaceItemId: string
  role: 'user' | 'assistant'
  content: string
}

export interface CreateTaskInput {
  projectId: string
  title: string
  description?: string
  status?: string
  priority?: number
  dueDate?: string
  parentId?: string
}

export interface TaskTagInput {
  taskId: string
  tagId: string
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
  recurrenceType?: RecurrenceType | null
  recurrenceInterval?: number | null
  nextResetAt?: string | null
}

export interface UpdateProjectInput {
  id: string
  name?: string
  color?: string
}

export interface CreateTagInput {
  name: string
  color?: string
}

export interface UpdateTagInput {
  id: string
  name?: string
  color?: string
}

export interface CreateWorkspaceItemInput {
  taskId: string
  type: WorkspaceItemType
  name: string
  content?: string  // For documents
  url?: string      // For browser tabs
}

export interface UpdateWorkspaceItemInput {
  id: string
  name?: string
  content?: string
  url?: string
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
    getSubtasks: (parentId: string) => Promise<Task[]>
    archiveTask: (id: string) => Promise<Task>
    unarchiveTask: (id: string) => Promise<Task>
    getArchivedTasks: () => Promise<Task[]>
    checkAndResetRecurring: () => Promise<number>
  }
  tags: {
    getTags: () => Promise<Tag[]>
    createTag: (data: CreateTagInput) => Promise<Tag>
    updateTag: (data: UpdateTagInput) => Promise<Tag>
    deleteTag: (id: string) => Promise<boolean>
  }
  taskTags: {
    getTagsForTask: (taskId: string) => Promise<Tag[]>
    setTagsForTask: (taskId: string, tagIds: string[]) => Promise<void>
  }
  settings: {
    get: (key: string) => Promise<string | null>
    set: (key: string, value: string) => Promise<void>
    getAll: () => Promise<Record<string, string>>
  }
  chatMessages: {
    getByWorkspace: (workspaceItemId: string) => Promise<ChatMessage[]>
    create: (data: CreateChatMessageInput) => Promise<ChatMessage>
    delete: (id: string) => Promise<boolean>
  }
  workspaceItems: {
    getByTask: (taskId: string) => Promise<WorkspaceItem[]>
    create: (data: CreateWorkspaceItemInput) => Promise<WorkspaceItem>
    update: (data: UpdateWorkspaceItemInput) => Promise<WorkspaceItem>
    delete: (id: string) => Promise<boolean>
  }
  claude: {
    stream: (prompt: string, context?: string) => Promise<void>
    cancel: () => void
    onChunk: (callback: (data: ClaudeStreamEvent) => void) => () => void
    onError: (callback: (error: string) => void) => () => void
    onDone: (callback: (result: { code: number }) => void) => () => void
    checkAvailability: () => Promise<ClaudeAvailability>
  }
  theme: {
    getEffective: () => Promise<Theme>
    getSource: () => Promise<ThemePreference>
    set: (theme: ThemePreference) => Promise<Theme>
    onChange: (callback: (theme: Theme) => void) => () => void
  }
}
