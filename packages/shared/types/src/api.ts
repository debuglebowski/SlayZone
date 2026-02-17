import type { Project, CreateProjectInput, UpdateProjectInput } from '@slayzone/projects/shared'
import type { Task, CreateTaskInput, UpdateTaskInput, GenerateDescriptionResult } from '@slayzone/task/shared'
import type { Tag, CreateTagInput, UpdateTagInput } from '@slayzone/tags/shared'
import type { TerminalMode, TerminalState, CodeMode, PtyInfo, PromptInfo, ClaudeAvailability, BufferSinceResult, ProviderUsage } from '@slayzone/terminal/shared'
import type { TerminalTab, CreateTerminalTabInput, UpdateTerminalTabInput } from '@slayzone/task-terminals/shared'
import type { Theme, ThemePreference } from '@slayzone/settings/shared'
import type { DetectedWorktree, MergeResult, MergeWithAIResult, GitDiffSnapshot, ConflictFileContent, ConflictAnalysis, RebaseProgress, CommitInfo, AheadBehind, StatusSummary } from '@slayzone/worktrees/shared'
import type { MergeContext } from '@slayzone/task/shared'
import type {
  AiConfigItem,
  AiConfigProjectSelection,
  CliProvider,
  CliProviderInfo,
  ContextFileInfo,
  ContextTreeEntry,
  CreateAiConfigItemInput,
  ListAiConfigItemsInput,
  LoadGlobalItemInput,
  McpConfigFileResult,
  ProjectSkillStatus,
  RootInstructionsResult,
  SetAiConfigProjectSelectionInput,
  SyncAllInput,
  SyncConflict,
  SyncResult,
  UpdateAiConfigItemInput,
  WriteMcpServerInput,
  RemoveMcpServerInput,
  GlobalFileEntry
} from '@slayzone/ai-config/shared'
import type { DirEntry, ReadFileResult } from '@slayzone/file-editor/shared'
import type {
  ConnectLinearInput,
  ExternalLink,
  ImportLinearIssuesInput,
  ImportLinearIssuesResult,
  IntegrationConnectionPublic,
  IntegrationProjectMapping,
  IntegrationProvider,
  ListLinearIssuesInput,
  LinearIssueSummary,
  LinearProject,
  LinearTeam,
  SetProjectMappingInput,
  SyncNowInput,
  SyncNowResult
} from '@slayzone/integrations/shared'

export interface DiagnosticsConfig {
  enabled: boolean
  verbose: boolean
  includePtyOutput: boolean
  retentionDays: number
}

export interface DiagnosticsExportRequest {
  fromTsMs: number
  toTsMs: number
}

export interface DiagnosticsExportResult {
  success: boolean
  canceled?: boolean
  path?: string
  eventCount?: number
  error?: string
}

export interface ClientErrorEventInput {
  type: 'window.error' | 'window.unhandledrejection' | 'error-boundary'
  message: string
  stack?: string | null
  componentStack?: string | null
  url?: string | null
  line?: number | null
  column?: number | null
  snapshot?: Record<string, unknown> | null
}

export interface ClientDiagnosticEventInput {
  event: string
  level?: 'debug' | 'info' | 'warn' | 'error'
  message?: string | null
  traceId?: string | null
  taskId?: string | null
  projectId?: string | null
  sessionId?: string | null
  channel?: string | null
  payload?: unknown
}

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
    getSubTasks: (parentId: string) => Promise<Task[]>
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
    onOpenSettings: (callback: () => void) => () => void
    onOpenProjectSettings: (callback: () => void) => () => void
    onNewTemporaryTask: (callback: () => void) => () => void
    onTasksChanged: (callback: () => void) => () => void
    onCloseTask: (callback: (taskId: string) => void) => () => void
    onOpenTask: (callback: (taskId: string) => void) => () => void
    onScreenshotTrigger: (callback: () => void) => () => void
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
      providerFlags?: string | null
    ) => Promise<{ success: boolean; error?: string }>
    write: (sessionId: string, data: string) => Promise<boolean>
    resize: (sessionId: string, cols: number, rows: number) => Promise<boolean>
    kill: (sessionId: string) => Promise<boolean>
    exists: (sessionId: string) => Promise<boolean>
    getBuffer: (sessionId: string) => Promise<string | null>
    clearBuffer: (
      sessionId: string
    ) => Promise<{ success: boolean; clearedSeq: number | null }>
    getBufferSince: (sessionId: string, afterSeq: number) => Promise<BufferSinceResult | null>
    list: () => Promise<PtyInfo[]>
    dismissAllNotifications: () => Promise<void>
    onData: (callback: (sessionId: string, data: string, seq: number) => void) => () => void
    onExit: (callback: (sessionId: string, exitCode: number) => void) => () => void
    onSessionNotFound: (callback: (sessionId: string) => void) => () => void
    onAttention: (callback: (sessionId: string) => void) => () => void
    onStateChange: (
      callback: (sessionId: string, newState: TerminalState, oldState: TerminalState) => void
    ) => () => void
    onPrompt: (callback: (sessionId: string, prompt: PromptInfo) => void) => () => void
    onSessionDetected: (callback: (sessionId: string, conversationId: string) => void) => () => void
    onDevServerDetected: (callback: (sessionId: string, url: string) => void) => () => void
    getState: (sessionId: string) => Promise<TerminalState | null>
  }
  git: {
    isGitRepo: (path: string) => Promise<boolean>
    detectWorktrees: (repoPath: string) => Promise<DetectedWorktree[]>
    createWorktree: (repoPath: string, targetPath: string, branch?: string) => Promise<void>
    removeWorktree: (repoPath: string, worktreePath: string) => Promise<void>
    init: (path: string) => Promise<void>
    getCurrentBranch: (path: string) => Promise<string | null>
    listBranches: (path: string) => Promise<string[]>
    checkoutBranch: (path: string, branch: string) => Promise<void>
    createBranch: (path: string, branch: string) => Promise<void>
    hasUncommittedChanges: (path: string) => Promise<boolean>
    mergeIntoParent: (projectPath: string, parentBranch: string, sourceBranch: string) => Promise<MergeResult>
    abortMerge: (path: string) => Promise<void>
    mergeWithAI: (projectPath: string, worktreePath: string, parentBranch: string, sourceBranch: string) => Promise<MergeWithAIResult>
    isMergeInProgress: (path: string) => Promise<boolean>
    getConflictedFiles: (path: string) => Promise<string[]>
    getWorkingDiff: (path: string) => Promise<GitDiffSnapshot>
    stageFile: (path: string, filePath: string) => Promise<void>
    unstageFile: (path: string, filePath: string) => Promise<void>
    discardFile: (path: string, filePath: string) => Promise<void>
    stageAll: (path: string) => Promise<void>
    unstageAll: (path: string) => Promise<void>
    getUntrackedFileDiff: (repoPath: string, filePath: string) => Promise<string>
    getConflictContent: (repoPath: string, filePath: string) => Promise<ConflictFileContent>
    writeResolvedFile: (repoPath: string, filePath: string, content: string) => Promise<void>
    commitFiles: (repoPath: string, message: string) => Promise<void>
    analyzeConflict: (mode: string, filePath: string, base: string | null, ours: string | null, theirs: string | null) => Promise<ConflictAnalysis>
    isRebaseInProgress: (path: string) => Promise<boolean>
    getRebaseProgress: (repoPath: string) => Promise<RebaseProgress | null>
    abortRebase: (path: string) => Promise<void>
    continueRebase: (path: string) => Promise<{ done: boolean; conflictedFiles: string[] }>
    skipRebaseCommit: (path: string) => Promise<{ done: boolean; conflictedFiles: string[] }>
    getMergeContext: (repoPath: string) => Promise<MergeContext | null>
    getRecentCommits: (repoPath: string, count?: number) => Promise<CommitInfo[]>
    getAheadBehind: (repoPath: string, branch: string, upstream: string) => Promise<AheadBehind>
    getStatusSummary: (repoPath: string) => Promise<StatusSummary>
  }
  tabs: {
    list: (taskId: string) => Promise<TerminalTab[]>
    create: (input: CreateTerminalTabInput) => Promise<TerminalTab>
    update: (input: UpdateTerminalTabInput) => Promise<TerminalTab | null>
    delete: (tabId: string) => Promise<boolean>
    ensureMain: (taskId: string, mode: TerminalMode) => Promise<TerminalTab>
  }
  diagnostics: {
    getConfig: () => Promise<DiagnosticsConfig>
    setConfig: (config: Partial<DiagnosticsConfig>) => Promise<DiagnosticsConfig>
    export: (request: DiagnosticsExportRequest) => Promise<DiagnosticsExportResult>
    recordClientError: (input: ClientErrorEventInput) => Promise<void>
    recordClientEvent: (input: ClientDiagnosticEventInput) => Promise<void>
  }
  aiConfig: {
    listItems: (input: ListAiConfigItemsInput) => Promise<AiConfigItem[]>
    getItem: (id: string) => Promise<AiConfigItem | null>
    createItem: (input: CreateAiConfigItemInput) => Promise<AiConfigItem>
    updateItem: (input: UpdateAiConfigItemInput) => Promise<AiConfigItem | null>
    deleteItem: (id: string) => Promise<boolean>
    listProjectSelections: (projectId: string) => Promise<AiConfigProjectSelection[]>
    setProjectSelection: (input: SetAiConfigProjectSelectionInput) => Promise<void>
    removeProjectSelection: (projectId: string, itemId: string) => Promise<boolean>
    discoverContextFiles: (projectPath: string) => Promise<ContextFileInfo[]>
    readContextFile: (filePath: string, projectPath: string) => Promise<string>
    writeContextFile: (filePath: string, content: string, projectPath: string) => Promise<void>
    getContextTree: (projectPath: string, projectId: string) => Promise<ContextTreeEntry[]>
    loadGlobalItem: (input: LoadGlobalItemInput) => Promise<ContextTreeEntry>
    syncLinkedFile: (projectId: string, projectPath: string, itemId: string) => Promise<ContextTreeEntry>
    unlinkFile: (projectId: string, itemId: string) => Promise<boolean>
    renameContextFile: (oldPath: string, newPath: string, projectPath: string) => Promise<void>
    deleteContextFile: (filePath: string, projectPath: string, projectId: string) => Promise<void>
    discoverMcpConfigs: (projectPath: string) => Promise<McpConfigFileResult[]>
    writeMcpServer: (input: WriteMcpServerInput) => Promise<void>
    removeMcpServer: (input: RemoveMcpServerInput) => Promise<void>
    listProviders: () => Promise<CliProviderInfo[]>
    toggleProvider: (id: string, enabled: boolean) => Promise<void>
    getProjectProviders: (projectId: string) => Promise<CliProvider[]>
    setProjectProviders: (projectId: string, providers: CliProvider[]) => Promise<void>
    needsSync: (projectId: string, projectPath: string) => Promise<boolean>
    syncAll: (input: SyncAllInput) => Promise<SyncResult>
    checkSyncStatus: (projectId: string, projectPath: string) => Promise<SyncConflict[]>
    getGlobalInstructions: () => Promise<string>
    saveGlobalInstructions: (content: string) => Promise<void>
    getRootInstructions: (projectId: string, projectPath: string) => Promise<RootInstructionsResult>
    saveRootInstructions: (projectId: string, projectPath: string, content: string) => Promise<RootInstructionsResult>
    getProjectSkillsStatus: (projectId: string, projectPath: string) => Promise<ProjectSkillStatus[]>
    getGlobalFiles: () => Promise<GlobalFileEntry[]>
  }
  fs: {
    readDir: (rootPath: string, dirPath: string) => Promise<DirEntry[]>
    readFile: (rootPath: string, filePath: string, force?: boolean) => Promise<ReadFileResult>
    writeFile: (rootPath: string, filePath: string, content: string) => Promise<void>
    createFile: (rootPath: string, filePath: string) => Promise<void>
    createDir: (rootPath: string, dirPath: string) => Promise<void>
    rename: (rootPath: string, oldPath: string, newPath: string) => Promise<void>
    delete: (rootPath: string, targetPath: string) => Promise<void>
    listAllFiles: (rootPath: string) => Promise<string[]>
    watch: (rootPath: string) => Promise<void>
    unwatch: (rootPath: string) => Promise<void>
    onFileChanged: (callback: (rootPath: string, relPath: string) => void) => () => void
  }
  screenshot: {
    captureRegion: (rect: {
      x: number
      y: number
      width: number
      height: number
    }) => Promise<{ success: boolean; path?: string }>
  }
  usage: {
    fetch: () => Promise<ProviderUsage[]>
  }
  webview: {
    enableDeviceEmulation: (
      webviewId: number,
      params: {
        screenSize: { width: number; height: number }
        viewSize: { width: number; height: number }
        deviceScaleFactor: number
        screenPosition: 'mobile' | 'desktop'
        userAgent?: string
      }
    ) => Promise<boolean>
    disableDeviceEmulation: (webviewId: number) => Promise<boolean>
  }
  integrations: {
    connectLinear: (input: ConnectLinearInput) => Promise<IntegrationConnectionPublic>
    listConnections: (provider?: IntegrationProvider) => Promise<IntegrationConnectionPublic[]>
    disconnect: (connectionId: string) => Promise<boolean>
    listLinearTeams: (connectionId: string) => Promise<LinearTeam[]>
    listLinearProjects: (connectionId: string, teamId: string) => Promise<LinearProject[]>
    listLinearIssues: (
      input: ListLinearIssuesInput
    ) => Promise<{ issues: LinearIssueSummary[]; nextCursor: string | null }>
    setProjectMapping: (input: SetProjectMappingInput) => Promise<IntegrationProjectMapping>
    getProjectMapping: (projectId: string, provider: IntegrationProvider) => Promise<IntegrationProjectMapping | null>
    importLinearIssues: (input: ImportLinearIssuesInput) => Promise<ImportLinearIssuesResult>
    syncNow: (input: SyncNowInput) => Promise<SyncNowResult>
    getLink: (taskId: string, provider: IntegrationProvider) => Promise<ExternalLink | null>
    unlinkTask: (taskId: string, provider: IntegrationProvider) => Promise<boolean>
  }
  exportImport: {
    exportAll: () => Promise<{ success: boolean; canceled?: boolean; path?: string; error?: string }>
    exportProject: (projectId: string) => Promise<{ success: boolean; canceled?: boolean; path?: string; error?: string }>
    import: () => Promise<{ success: boolean; canceled?: boolean; projectCount?: number; taskCount?: number; importedProjects?: Array<{ id: string; name: string }>; error?: string }>
  }
}
