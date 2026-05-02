export interface DeviceEmulation {
  name: string
  width: number
  height: number
  deviceScaleFactor: number
  mobile: boolean
  userAgent?: string
  category?: string
}

// --- Multi-device preview ---

export type DeviceSlot = 'desktop' | 'tablet' | 'mobile'
export type GridLayout = 'horizontal' | 'vertical'

export interface DeviceSlotConfig {
  enabled: boolean
  preset: DeviceEmulation
}

export type MultiDeviceConfig = Record<DeviceSlot, DeviceSlotConfig>

export type BrowserTabTheme = 'system' | 'light' | 'dark'

export interface BrowserTab {
  id: string
  url: string
  title: string
  customName?: string
  favicon?: string
  themeMode?: BrowserTabTheme
  multiDeviceMode?: boolean
  multiDeviceConfig?: MultiDeviceConfig
  multiDeviceLayout?: GridLayout
}

export interface BrowserTabsState {
  tabs: BrowserTab[]
  activeTabId: string | null
}
