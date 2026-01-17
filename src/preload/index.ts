import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { ElectronAPI } from '../shared/types/api'

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
    deleteTask: (id) => ipcRenderer.invoke('db:tasks:delete', id)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
