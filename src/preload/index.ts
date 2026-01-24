import { contextBridge, ipcRenderer } from 'electron'
import type { ElectronAPI, TerminalState, PromptInfo } from '../shared/types/api'

// Custom APIs for renderer
const api: ElectronAPI = {
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
    unarchiveTask: (id) => ipcRenderer.invoke('db:tasks:unarchive', id),
    getArchivedTasks: () => ipcRenderer.invoke('db:tasks:getArchived')
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
    getVersion: () => ipcRenderer.invoke('app:getVersion')
  },
  pty: {
    create: (taskId, cwd, sessionId, existingSessionId, mode) =>
      ipcRenderer.invoke('pty:create', taskId, cwd, sessionId, existingSessionId, mode),
    write: (taskId, data) => ipcRenderer.invoke('pty:write', taskId, data),
    resize: (taskId, cols, rows) => ipcRenderer.invoke('pty:resize', taskId, cols, rows),
    kill: (taskId) => ipcRenderer.invoke('pty:kill', taskId),
    exists: (taskId) => ipcRenderer.invoke('pty:exists', taskId),
    getBuffer: (taskId) => ipcRenderer.invoke('pty:getBuffer', taskId),
    list: () => ipcRenderer.invoke('pty:list'),
    onData: (callback: (taskId: string, data: string) => void) => {
      const handler = (_event: unknown, taskId: string, data: string) => callback(taskId, data)
      ipcRenderer.on('pty:data', handler)
      return () => ipcRenderer.removeListener('pty:data', handler)
    },
    onExit: (callback: (taskId: string, exitCode: number) => void) => {
      const handler = (_event: unknown, taskId: string, exitCode: number) =>
        callback(taskId, exitCode)
      ipcRenderer.on('pty:exit', handler)
      return () => ipcRenderer.removeListener('pty:exit', handler)
    },
    onSessionNotFound: (callback: (taskId: string) => void) => {
      const handler = (_event: unknown, taskId: string) => callback(taskId)
      ipcRenderer.on('pty:session-not-found', handler)
      return () => ipcRenderer.removeListener('pty:session-not-found', handler)
    },
    onIdle: (callback: (taskId: string) => void) => {
      const handler = (_event: unknown, taskId: string) => callback(taskId)
      ipcRenderer.on('pty:idle', handler)
      return () => ipcRenderer.removeListener('pty:idle', handler)
    },
    onStateChange: (
      callback: (taskId: string, newState: TerminalState, oldState: TerminalState) => void
    ) => {
      const handler = (
        _event: unknown,
        taskId: string,
        newState: TerminalState,
        oldState: TerminalState
      ) => callback(taskId, newState, oldState)
      ipcRenderer.on('pty:state-change', handler)
      return () => ipcRenderer.removeListener('pty:state-change', handler)
    },
    onPrompt: (callback: (taskId: string, prompt: PromptInfo) => void) => {
      const handler = (_event: unknown, taskId: string, prompt: PromptInfo) =>
        callback(taskId, prompt)
      ipcRenderer.on('pty:prompt', handler)
      return () => ipcRenderer.removeListener('pty:prompt', handler)
    },
    getState: (taskId: string) => ipcRenderer.invoke('pty:getState', taskId)
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
