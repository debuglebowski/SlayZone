import type { ElectronAPI } from './api'

declare global {
  interface Window {
    api: ElectronAPI
  }
}

export {}
