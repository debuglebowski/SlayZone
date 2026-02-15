export interface DeviceEmulation {
  name: string
  width: number
  height: number
  deviceScaleFactor: number
  mobile: boolean
  userAgent?: string
}

export interface BrowserTab {
  id: string
  url: string
  title: string
  favicon?: string
  deviceEmulation?: DeviceEmulation | null
}

export interface BrowserTabsState {
  tabs: BrowserTab[]
  activeTabId: string | null
}
