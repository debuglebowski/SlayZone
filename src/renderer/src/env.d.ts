/// <reference types="vite/client" />

import type { ElectronAPI } from '../../shared/types/api'

declare global {
  interface Window {
    api: ElectronAPI
  }
}
