import { ElectronAPI as ElectronToolkitAPI } from '@electron-toolkit/preload'
import type { ElectronAPI } from '../shared/types/api'

declare global {
  interface Window {
    electron: ElectronToolkitAPI
    api: ElectronAPI
  }
}
