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

export interface BrowserTab {
  id: string
  url: string
  title: string
  favicon?: string
  multiDeviceMode?: boolean
  multiDeviceConfig?: MultiDeviceConfig
  multiDeviceLayout?: GridLayout
}

export interface BrowserTabsState {
  tabs: BrowserTab[]
  activeTabId: string | null
}

// --- Resolution environment presets ---

export type WebPanelEnvironment = 'desktop' | 'tablet' | 'mobile'

export interface WebPanelResolutionDefaults {
  desktop: { width: number; height: number }
  tablet:  { width: number; height: number }
  mobile:  { width: number; height: number }
}

export const DEFAULT_WEB_PANEL_RESOLUTION_DEFAULTS: WebPanelResolutionDefaults = {
  desktop: { width: 1920, height: 1080 },
  tablet:  { width: 768,  height: 1024 },
  mobile:  { width: 375,  height: 667  },
}
