import { contextBridge, ipcRenderer } from 'electron'
import type { ElectronAPI } from '@omgslayzone/types'
import type { TerminalState, PromptInfo } from '@omgslayzone/terminal/shared'

// Custom APIs for renderer
const api: ElectronAPI = {
  ai: {
    generateDescription: (title, mode) => ipcRenderer.invoke('ai:generate-description', title, mode)
  },
  db: {
    // Projects
    getProjects: () => ipcRenderer.invoke('db:projects:getAll'),
    createProject: (data) => ipcRenderer.invoke('db:projects:create', data),
    updateProject: (data) => ipcRenderer.invoke('db:projects:update', data),
    deleteProject: (id) => ipcRenderer.invoke('db:projects:delete', id),

    // Tasks
    getTasks: () => ipcRenderer.invoke('db:tasks:getAll'),
    getTasksByProject: (projectId) => ipcRenderer.invoke('db:tasks:getByProject', projectId),
    getTask: (id) => ipcRenderer.invoke('db:tasks:get', id),
    createTask: (data) => ipcRenderer.invoke('db:tasks:create', data),
    updateTask: (data) => ipcRenderer.invoke('db:tasks:update', data),
    deleteTask: (id) => ipcRenderer.invoke('db:tasks:delete', id),
    archiveTask: (id) => ipcRenderer.invoke('db:tasks:archive', id),
    archiveTasks: (ids) => ipcRenderer.invoke('db:tasks:archiveMany', ids),
    unarchiveTask: (id) => ipcRenderer.invoke('db:tasks:unarchive', id),
    getArchivedTasks: () => ipcRenderer.invoke('db:tasks:getArchived'),
    reorderTasks: (taskIds) => ipcRenderer.invoke('db:tasks:reorder', taskIds)
  },
  tags: {
    getTags: () => ipcRenderer.invoke('db:tags:getAll'),
    createTag: (data) => ipcRenderer.invoke('db:tags:create', data),
    updateTag: (data) => ipcRenderer.invoke('db:tags:update', data),
    deleteTag: (id) => ipcRenderer.invoke('db:tags:delete', id)
  },
  taskTags: {
    getTagsForTask: (taskId) => ipcRenderer.invoke('db:taskTags:getForTask', taskId),
    setTagsForTask: (taskId, tagIds) => ipcRenderer.invoke('db:taskTags:setForTask', taskId, tagIds)
  },
  taskDependencies: {
    getBlockers: (taskId) => ipcRenderer.invoke('db:taskDependencies:getBlockers', taskId),
    getBlocking: (taskId) => ipcRenderer.invoke('db:taskDependencies:getBlocking', taskId),
    addBlocker: (taskId, blockerTaskId) =>
      ipcRenderer.invoke('db:taskDependencies:addBlocker', taskId, blockerTaskId),
    removeBlocker: (taskId, blockerTaskId) =>
      ipcRenderer.invoke('db:taskDependencies:removeBlocker', taskId, blockerTaskId),
    setBlockers: (taskId, blockerTaskIds) =>
      ipcRenderer.invoke('db:taskDependencies:setBlockers', taskId, blockerTaskIds)
  },
  settings: {
    get: (key) => ipcRenderer.invoke('db:settings:get', key),
    set: (key, value) => ipcRenderer.invoke('db:settings:set', key, value),
    getAll: () => ipcRenderer.invoke('db:settings:getAll')
  },
  claude: {
    checkAvailability: () => ipcRenderer.invoke('claude:check-availability')
  },
  theme: {
    getEffective: () => ipcRenderer.invoke('theme:get-effective'),
    getSource: () => ipcRenderer.invoke('theme:get-source'),
    set: (theme: 'light' | 'dark' | 'system') => ipcRenderer.invoke('theme:set', theme),
    onChange: (callback: (theme: 'light' | 'dark') => void) => {
      const handler = (_event: unknown, theme: 'light' | 'dark') => callback(theme)
      ipcRenderer.on('theme:changed', handler)
      return () => ipcRenderer.removeListener('theme:changed', handler)
    }
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url)
  },
  dialog: {
    showOpenDialog: (options) => ipcRenderer.invoke('dialog:showOpenDialog', options)
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    onGoHome: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('app:go-home', handler)
      return () => ipcRenderer.removeListener('app:go-home', handler)
    }
  },
  window: {
    close: () => ipcRenderer.invoke('window:close')
  },
  files: {
    saveTempImage: (base64, mimeType) => ipcRenderer.invoke('files:saveTempImage', base64, mimeType)
  },
  pty: {
    create: (sessionId, cwd, conversationId, existingConversationId, mode, initialPrompt, codeMode, dangerouslySkipPermissions) =>
      ipcRenderer.invoke('pty:create', sessionId, cwd, conversationId, existingConversationId, mode, initialPrompt, codeMode, dangerouslySkipPermissions),
    write: (sessionId, data) => ipcRenderer.invoke('pty:write', sessionId, data),
    resize: (sessionId, cols, rows) => ipcRenderer.invoke('pty:resize', sessionId, cols, rows),
    kill: (sessionId) => ipcRenderer.invoke('pty:kill', sessionId),
    exists: (sessionId) => ipcRenderer.invoke('pty:exists', sessionId),
    getBuffer: (sessionId) => ipcRenderer.invoke('pty:getBuffer', sessionId),
    getBufferSince: (sessionId, afterSeq) => ipcRenderer.invoke('pty:getBufferSince', sessionId, afterSeq),
    list: () => ipcRenderer.invoke('pty:list'),
    onData: (callback: (sessionId: string, data: string, seq: number) => void) => {
      const handler = (_event: unknown, sessionId: string, data: string, seq: number) => callback(sessionId, data, seq)
      ipcRenderer.on('pty:data', handler)
      return () => ipcRenderer.removeListener('pty:data', handler)
    },
    onExit: (callback: (sessionId: string, exitCode: number) => void) => {
      const handler = (_event: unknown, sessionId: string, exitCode: number) =>
        callback(sessionId, exitCode)
      ipcRenderer.on('pty:exit', handler)
      return () => ipcRenderer.removeListener('pty:exit', handler)
    },
    onSessionNotFound: (callback: (sessionId: string) => void) => {
      const handler = (_event: unknown, sessionId: string) => callback(sessionId)
      ipcRenderer.on('pty:session-not-found', handler)
      return () => ipcRenderer.removeListener('pty:session-not-found', handler)
    },
    onAttention: (callback: (sessionId: string) => void) => {
      const handler = (_event: unknown, sessionId: string) => callback(sessionId)
      ipcRenderer.on('pty:attention', handler)
      return () => ipcRenderer.removeListener('pty:attention', handler)
    },
    onStateChange: (
      callback: (sessionId: string, newState: TerminalState, oldState: TerminalState) => void
    ) => {
      const handler = (
        _event: unknown,
        sessionId: string,
        newState: TerminalState,
        oldState: TerminalState
      ) => callback(sessionId, newState, oldState)
      ipcRenderer.on('pty:state-change', handler)
      return () => ipcRenderer.removeListener('pty:state-change', handler)
    },
    onPrompt: (callback: (sessionId: string, prompt: PromptInfo) => void) => {
      const handler = (_event: unknown, sessionId: string, prompt: PromptInfo) =>
        callback(sessionId, prompt)
      ipcRenderer.on('pty:prompt', handler)
      return () => ipcRenderer.removeListener('pty:prompt', handler)
    },
    onSessionDetected: (callback: (sessionId: string, conversationId: string) => void) => {
      const handler = (_event: unknown, sessionId: string, conversationId: string) =>
        callback(sessionId, conversationId)
      ipcRenderer.on('pty:session-detected', handler)
      return () => ipcRenderer.removeListener('pty:session-detected', handler)
    },
    getState: (sessionId: string) => ipcRenderer.invoke('pty:getState', sessionId)
  },
  git: {
    isGitRepo: (path) => ipcRenderer.invoke('git:isGitRepo', path),
    detectWorktrees: (repoPath) => ipcRenderer.invoke('git:detectWorktrees', repoPath),
    createWorktree: (repoPath, targetPath, branch) =>
      ipcRenderer.invoke('git:createWorktree', repoPath, targetPath, branch),
    removeWorktree: (repoPath, worktreePath) =>
      ipcRenderer.invoke('git:removeWorktree', repoPath, worktreePath),
    init: (path) => ipcRenderer.invoke('git:init', path),
    getCurrentBranch: (path) => ipcRenderer.invoke('git:getCurrentBranch', path),
    hasUncommittedChanges: (path) => ipcRenderer.invoke('git:hasUncommittedChanges', path),
    mergeIntoParent: (projectPath, parentBranch, sourceBranch) =>
      ipcRenderer.invoke('git:mergeIntoParent', projectPath, parentBranch, sourceBranch),
    abortMerge: (path) => ipcRenderer.invoke('git:abortMerge', path)
  },
  tabs: {
    list: (taskId) => ipcRenderer.invoke('tabs:list', taskId),
    create: (input) => ipcRenderer.invoke('tabs:create', input),
    update: (input) => ipcRenderer.invoke('tabs:update', input),
    delete: (tabId) => ipcRenderer.invoke('tabs:delete', tabId),
    ensureMain: (taskId, mode) => ipcRenderer.invoke('tabs:ensureMain', taskId, mode)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.api = api
}
