/// <reference types="vite/client" />

import type { ElectronAPI } from '@omgslayzone/types'

declare global {
  interface Window {
    api: ElectronAPI
  }
}
