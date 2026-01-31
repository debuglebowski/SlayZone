import type { Project, CreateProjectInput, UpdateProjectInput } from '@omgslayzone/projects/shared'
import type { Task, CreateTaskInput, UpdateTaskInput, GenerateDescriptionResult } from '@omgslayzone/task/shared'
import type { Tag, CreateTagInput, UpdateTagInput } from '@omgslayzone/tags/shared'
import type { TerminalMode, TerminalState, CodeMode, PtyInfo, PromptInfo, ClaudeAvailability, BufferSinceResult } from '@omgslayzone/terminal/shared'
import type { Theme, ThemePreference } from '@omgslayzone/settings/shared'
import type { DetectedWorktree } from '@omgslayzone/worktrees/shared'

// ElectronAPI interface - the IPC contract between renderer and main
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
    getBufferSince: (taskId: string, afterSeq: number) => Promise<BufferSinceResult | null>
    list: () => Promise<PtyInfo[]>
    onData: (callback: (taskId: string, data: string, seq: number) => void) => () => void
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
  git: {
    isGitRepo: (path: string) => Promise<boolean>
    detectWorktrees: (repoPath: string) => Promise<DetectedWorktree[]>
    createWorktree: (repoPath: string, targetPath: string, branch?: string) => Promise<void>
    removeWorktree: (repoPath: string, worktreePath: string) => Promise<void>
    init: (path: string) => Promise<void>
    getCurrentBranch: (path: string) => Promise<string | null>
  }
}
