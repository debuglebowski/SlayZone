export interface BrowserTab {
  id: string
  url: string
  title: string
  favicon?: string
}

export interface BrowserTabsState {
  tabs: BrowserTab[]
  activeTabId: string | null
}
