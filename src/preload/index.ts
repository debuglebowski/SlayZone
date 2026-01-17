import { contextBridge, ipcRenderer } from 'electron'
import type { ElectronAPI, ClaudeStreamEvent } from '../shared/types/api'

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
    getSubtasks: (parentId) => ipcRenderer.invoke('db:tasks:getSubtasks', parentId),
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
  settings: {
    get: (key) => ipcRenderer.invoke('db:settings:get', key),
    set: (key, value) => ipcRenderer.invoke('db:settings:set', key, value),
    getAll: () => ipcRenderer.invoke('db:settings:getAll')
  },
  chatMessages: {
    getByWorkspace: (workspaceItemId) =>
      ipcRenderer.invoke('db:chatMessages:getByWorkspace', workspaceItemId),
    create: (data) => ipcRenderer.invoke('db:chatMessages:create', data),
    delete: (id) => ipcRenderer.invoke('db:chatMessages:delete', id)
  },
  workspaceItems: {
    getByTask: (taskId) => ipcRenderer.invoke('db:workspaceItems:getByTask', taskId),
    create: (data) => ipcRenderer.invoke('db:workspaceItems:create', data),
    update: (data) => ipcRenderer.invoke('db:workspaceItems:update', data),
    delete: (id) => ipcRenderer.invoke('db:workspaceItems:delete', id)
  },
  claude: {
    stream: (prompt: string, context?: string) => {
      return ipcRenderer.invoke('claude:stream:start', prompt, context)
    },
    cancel: () => {
      ipcRenderer.send('claude:stream:cancel')
    },
    onChunk: (callback: (data: ClaudeStreamEvent) => void) => {
      const handler = (_event: unknown, data: ClaudeStreamEvent) => callback(data)
      ipcRenderer.on('claude:chunk', handler)
      return () => ipcRenderer.removeListener('claude:chunk', handler)
    },
    onError: (callback: (error: string) => void) => {
      const handler = (_event: unknown, error: string) => callback(error)
      ipcRenderer.on('claude:error', handler)
      return () => ipcRenderer.removeListener('claude:error', handler)
    },
    onDone: (callback: (result: { code: number }) => void) => {
      const handler = (_event: unknown, result: { code: number }) => callback(result)
      ipcRenderer.on('claude:done', handler)
      return () => ipcRenderer.removeListener('claude:done', handler)
    }
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
