import { ElectronAPI as ElectronToolkitAPI } from '@electron-toolkit/preload'
import type { ElectronAPI } from '@omgslayzone/types'

declare global {
  interface Window {
    electron: ElectronToolkitAPI
    api: ElectronAPI
  }
}
