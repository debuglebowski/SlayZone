// Re-export domain types for backwards compatibility
export type { Task, TaskStatus, TaskDependency, CreateTaskInput, UpdateTaskInput } from '../domains/task'
export type { Project, CreateProjectInput, UpdateProjectInput } from '../domains/project'
export type { Tag, CreateTagInput, UpdateTagInput, TaskTagInput } from '../domains/tag'
export type {
  TerminalMode,
  TerminalState,
  CodeMode,
  ActivityState,
  ErrorInfo,
  CLIState,
  PtyInfo,
  PromptInfo
} from '../domains/terminal'
export type { Theme, ThemePreference } from '../domains/settings'
export type { ClaudeAvailability, GenerateDescriptionResult } from '../domains/ai'

// ElectronAPI interface - stays here as it's the IPC contract
export interface ElectronAPI {
  ai: {
    generateDescription: (
      title: string,
      mode: import('../domains/terminal').TerminalMode
    ) => Promise<import('../domains/ai').GenerateDescriptionResult>
  }
  db: {
    // Projects
    getProjects: () => Promise<import('../domains/project').Project[]>
    createProject: (
      data: import('../domains/project').CreateProjectInput
    ) => Promise<import('../domains/project').Project>
    updateProject: (
      data: import('../domains/project').UpdateProjectInput
    ) => Promise<import('../domains/project').Project>
    deleteProject: (id: string) => Promise<boolean>

    // Tasks
    getTasks: () => Promise<import('../domains/task').Task[]>
    getTasksByProject: (projectId: string) => Promise<import('../domains/task').Task[]>
    getTask: (id: string) => Promise<import('../domains/task').Task | null>
    createTask: (data: import('../domains/task').CreateTaskInput) => Promise<import('../domains/task').Task>
    updateTask: (data: import('../domains/task').UpdateTaskInput) => Promise<import('../domains/task').Task>
    deleteTask: (id: string) => Promise<boolean>
    archiveTask: (id: string) => Promise<import('../domains/task').Task>
    archiveTasks: (ids: string[]) => Promise<void>
    unarchiveTask: (id: string) => Promise<import('../domains/task').Task>
    getArchivedTasks: () => Promise<import('../domains/task').Task[]>
    reorderTasks: (taskIds: string[]) => Promise<void>
  }
  tags: {
    getTags: () => Promise<import('../domains/tag').Tag[]>
    createTag: (data: import('../domains/tag').CreateTagInput) => Promise<import('../domains/tag').Tag>
    updateTag: (data: import('../domains/tag').UpdateTagInput) => Promise<import('../domains/tag').Tag>
    deleteTag: (id: string) => Promise<boolean>
  }
  taskTags: {
    getTagsForTask: (taskId: string) => Promise<import('../domains/tag').Tag[]>
    setTagsForTask: (taskId: string, tagIds: string[]) => Promise<void>
  }
  taskDependencies: {
    getBlockers: (taskId: string) => Promise<import('../domains/task').Task[]>
    getBlocking: (taskId: string) => Promise<import('../domains/task').Task[]>
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
    checkAvailability: () => Promise<import('../domains/ai').ClaudeAvailability>
  }
  theme: {
    getEffective: () => Promise<import('../domains/settings').Theme>
    getSource: () => Promise<import('../domains/settings').ThemePreference>
    set: (theme: import('../domains/settings').ThemePreference) => Promise<import('../domains/settings').Theme>
    onChange: (callback: (theme: import('../domains/settings').Theme) => void) => () => void
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
      mode?: import('../domains/terminal').TerminalMode,
      initialPrompt?: string | null,
      codeMode?: import('../domains/terminal').CodeMode | null
    ) => Promise<{ success: boolean; error?: string }>
    write: (taskId: string, data: string) => Promise<boolean>
    resize: (taskId: string, cols: number, rows: number) => Promise<boolean>
    kill: (taskId: string) => Promise<boolean>
    exists: (taskId: string) => Promise<boolean>
    getBuffer: (taskId: string) => Promise<string | null>
    list: () => Promise<import('../domains/terminal').PtyInfo[]>
    onData: (callback: (taskId: string, data: string) => void) => () => void
    onExit: (callback: (taskId: string, exitCode: number) => void) => () => void
    onSessionNotFound: (callback: (taskId: string) => void) => () => void
    onIdle: (callback: (taskId: string) => void) => () => void
    onStateChange: (
      callback: (
        taskId: string,
        newState: import('../domains/terminal').TerminalState,
        oldState: import('../domains/terminal').TerminalState
      ) => void
    ) => () => void
    onPrompt: (
      callback: (taskId: string, prompt: import('../domains/terminal').PromptInfo) => void
    ) => () => void
    onSessionDetected: (callback: (taskId: string, sessionId: string) => void) => () => void
    getState: (taskId: string) => Promise<import('../domains/terminal').TerminalState | null>
  }
}
