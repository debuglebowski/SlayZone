import type { Project, CreateProjectInput, UpdateProjectInput } from '@slayzone/projects/shared'
import type { Task, CreateTaskInput, UpdateTaskInput, GenerateDescriptionResult } from '@slayzone/task/shared'
import type { Tag, CreateTagInput, UpdateTagInput } from '@slayzone/tags/shared'
import type { TerminalMode, TerminalState, CodeMode, PtyInfo, PromptInfo, ClaudeAvailability, BufferSinceResult } from '@slayzone/terminal/shared'
import type { TerminalTab, CreateTerminalTabInput, UpdateTerminalTabInput } from '@slayzone/task-terminals/shared'
import type { Theme, ThemePreference } from '@slayzone/settings/shared'
import type { DetectedWorktree, MergeResult, MergeWithAIResult, GitDiffSnapshot } from '@slayzone/worktrees/shared'

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
    pathExists: (path: string) => Promise<boolean>
  }
  pty: {
    create: (
      sessionId: string,
      cwd: string,
      conversationId?: string | null,
      existingConversationId?: string | null,
      mode?: TerminalMode,
      initialPrompt?: string | null,
      codeMode?: CodeMode | null,
      dangerouslySkipPermissions?: boolean
    ) => Promise<{ success: boolean; error?: string }>
    write: (sessionId: string, data: string) => Promise<boolean>
    resize: (sessionId: string, cols: number, rows: number) => Promise<boolean>
    kill: (sessionId: string) => Promise<boolean>
    exists: (sessionId: string) => Promise<boolean>
    getBuffer: (sessionId: string) => Promise<string | null>
    getBufferSince: (sessionId: string, afterSeq: number) => Promise<BufferSinceResult | null>
    list: () => Promise<PtyInfo[]>
    onData: (callback: (sessionId: string, data: string, seq: number) => void) => () => void
    onExit: (callback: (sessionId: string, exitCode: number) => void) => () => void
    onSessionNotFound: (callback: (sessionId: string) => void) => () => void
    onAttention: (callback: (sessionId: string) => void) => () => void
    onStateChange: (
      callback: (sessionId: string, newState: TerminalState, oldState: TerminalState) => void
    ) => () => void
    onPrompt: (callback: (sessionId: string, prompt: PromptInfo) => void) => () => void
    onSessionDetected: (callback: (sessionId: string, conversationId: string) => void) => () => void
    getState: (sessionId: string) => Promise<TerminalState | null>
  }
  git: {
    isGitRepo: (path: string) => Promise<boolean>
    detectWorktrees: (repoPath: string) => Promise<DetectedWorktree[]>
    createWorktree: (repoPath: string, targetPath: string, branch?: string) => Promise<void>
    removeWorktree: (repoPath: string, worktreePath: string) => Promise<void>
    init: (path: string) => Promise<void>
    getCurrentBranch: (path: string) => Promise<string | null>
    hasUncommittedChanges: (path: string) => Promise<boolean>
    mergeIntoParent: (projectPath: string, parentBranch: string, sourceBranch: string) => Promise<MergeResult>
    abortMerge: (path: string) => Promise<void>
    mergeWithAI: (projectPath: string, worktreePath: string, parentBranch: string, sourceBranch: string) => Promise<MergeWithAIResult>
    isMergeInProgress: (path: string) => Promise<boolean>
    getConflictedFiles: (path: string) => Promise<string[]>
    getWorkingDiff: (path: string) => Promise<GitDiffSnapshot>
    stageFile: (path: string, filePath: string) => Promise<void>
    unstageFile: (path: string, filePath: string) => Promise<void>
  }
  tabs: {
    list: (taskId: string) => Promise<TerminalTab[]>
    create: (input: CreateTerminalTabInput) => Promise<TerminalTab>
    update: (input: UpdateTerminalTabInput) => Promise<TerminalTab | null>
    delete: (tabId: string) => Promise<boolean>
    ensureMain: (taskId: string, mode: TerminalMode) => Promise<TerminalTab>
  }
}
