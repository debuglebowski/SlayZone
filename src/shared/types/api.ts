import type { Task, Project, Tag, TaskStatus } from './database'

// Theme types
export type Theme = 'light' | 'dark'
export type ThemePreference = 'light' | 'dark' | 'system'

// Claude CLI types
export interface ClaudeAvailability {
  available: boolean
  path: string | null
  version: string | null
}

// PTY types
export type TerminalState = 'starting' | 'running' | 'idle' | 'awaiting_input' | 'error' | 'dead'
export type TerminalMode = 'claude-code' | 'codex' | 'terminal'
export type CodeMode = 'normal' | 'plan' | 'accept-edits' | 'bypass'

export interface PtyInfo {
  taskId: string
  lastOutputTime: number
  state: TerminalState
}

export interface PromptInfo {
  type: 'permission' | 'question' | 'input'
  text: string
  position: number
}

export interface CreateTaskInput {
  projectId: string
  title: string
  description?: string
  status?: string
  priority?: number
  dueDate?: string
}

export interface TaskTagInput {
  taskId: string
  tagId: string
}

export interface CreateProjectInput {
  name: string
  color: string
  path?: string
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
  dangerouslySkipPermissions?: boolean
  // Legacy
  claudeSessionId?: string | null
}

export interface UpdateProjectInput {
  id: string
  name?: string
  color?: string
  path?: string | null
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

export interface GenerateDescriptionResult {
  success: boolean
  description?: string
  error?: string
}

export interface ElectronAPI {
  ai: {
    generateDescription: (title: string, mode: TerminalMode) => Promise<GenerateDescriptionResult>
  }
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
    archiveTask: (id: string) => Promise<Task>
    archiveTasks: (ids: string[]) => Promise<void>
    unarchiveTask: (id: string) => Promise<Task>
    getArchivedTasks: () => Promise<Task[]>
    reorderTasks: (taskIds: string[]) => Promise<void>
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
  taskDependencies: {
    getBlockers: (taskId: string) => Promise<Task[]>
    getBlocking: (taskId: string) => Promise<Task[]>
    addBlocker: (taskId: string, blockerTaskId: string) => Promise<void>
    removeBlocker: (taskId: string, blockerTaskId: string) => Promise<void>
    setBlockers: (taskId: string, blockerTaskIds: string[]) => Promise<void>
  }
  settings: {
    get: (key: string) => Promise<string | null>
    set: (key: string, value: string) => Promise<void>
    getAll: () => Promise<Record<string, string>>
  }
  claude: {
    checkAvailability: () => Promise<ClaudeAvailability>
  }
  theme: {
    getEffective: () => Promise<Theme>
    getSource: () => Promise<ThemePreference>
    set: (theme: ThemePreference) => Promise<Theme>
    onChange: (callback: (theme: Theme) => void) => () => void
  }
  shell: {
    openExternal: (url: string) => Promise<void>
  }
  dialog: {
    showOpenDialog: (options: {
      title?: string
      defaultPath?: string
      properties?: Array<'openFile' | 'openDirectory' | 'multiSelections'>
    }) => Promise<{ canceled: boolean; filePaths: string[] }>
  }
  app: {
    getVersion: () => Promise<string>
    onGoHome: (callback: () => void) => () => void
  }
  window: {
    close: () => Promise<void>
  }
  files: {
    saveTempImage: (
      base64: string,
      mimeType: string
    ) => Promise<{ success: boolean; path?: string; error?: string }>
  }
  pty: {
    create: (
      taskId: string,
      cwd: string,
      sessionId?: string | null,
      existingSessionId?: string | null,
      mode?: TerminalMode,
      initialPrompt?: string | null,
      codeMode?: CodeMode | null
    ) => Promise<{ success: boolean; error?: string }>
    write: (taskId: string, data: string) => Promise<boolean>
    resize: (taskId: string, cols: number, rows: number) => Promise<boolean>
    kill: (taskId: string) => Promise<boolean>
    exists: (taskId: string) => Promise<boolean>
    getBuffer: (taskId: string) => Promise<string | null>
    list: () => Promise<PtyInfo[]>
    onData: (callback: (taskId: string, data: string) => void) => () => void
    onExit: (callback: (taskId: string, exitCode: number) => void) => () => void
    onSessionNotFound: (callback: (taskId: string) => void) => () => void
    onIdle: (callback: (taskId: string) => void) => () => void
    onStateChange: (
      callback: (taskId: string, newState: TerminalState, oldState: TerminalState) => void
    ) => () => void
    onPrompt: (callback: (taskId: string, prompt: PromptInfo) => void) => () => void
    onSessionDetected: (callback: (taskId: string, sessionId: string) => void) => () => void
    getState: (taskId: string) => Promise<TerminalState | null>
  }
}
