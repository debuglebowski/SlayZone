/// <reference types="vite/client" />

import type { ElectronAPI } from '@slayzone/types'

declare global {
  interface Window {
    api: ElectronAPI
  }
}
