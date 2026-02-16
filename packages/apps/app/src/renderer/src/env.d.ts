/// <reference types="vite/client" />

import type { ElectronAPI } from '@slayzone/types'

declare global {
  interface Window {
    api: ElectronAPI
  }

  const __PLAYWRIGHT__: boolean
  const __DEV__: boolean
}
