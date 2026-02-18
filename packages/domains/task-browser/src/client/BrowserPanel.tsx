import { useState, useRef, useEffect, useCallback } from 'react'
import { ArrowLeft, ArrowRight, RotateCw, X, Plus, Import, Smartphone, Monitor, Tablet, LayoutGrid, ChevronDown } from 'lucide-react'
import {
  Button,
  Input,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@slayzone/ui'
import type { BrowserTab, BrowserTabsState, MultiDeviceConfig, GridLayout, DeviceSlot } from '../shared'
import { defaultMultiDeviceConfig } from './device-presets'
import { MultiDeviceGrid } from './MultiDeviceGrid'

const SLOT_BUTTONS: { slot: DeviceSlot; icon: typeof Monitor; label: string }[] = [
  { slot: 'desktop', icon: Monitor, label: 'Desktop' },
  { slot: 'tablet', icon: Tablet, label: 'Tablet' },
  { slot: 'mobile', icon: Smartphone, label: 'Mobile' },
]

interface TaskUrlEntry {
  taskId: string
  taskTitle: string
  url: string
  tabTitle: string
}

// Minimal webview interface for type safety
interface WebviewElement extends HTMLElement {
  canGoBack(): boolean
  canGoForward(): boolean
  goBack(): void
  goForward(): void
  reload(): void
  stop(): void
  loadURL(url: string): void
  getURL(): string
  getWebContentsId(): number
}

interface BrowserPanelProps {
  className?: string
  tabs: BrowserTabsState
  onTabsChange: (tabs: BrowserTabsState) => void
  taskId?: string
  isResizing?: boolean
}

function generateTabId(): string {
  return `tab-${crypto.randomUUID().slice(0, 8)}`
}

export function BrowserPanel({ className, tabs, onTabsChange, taskId, isResizing }: BrowserPanelProps) {
  const [inputUrl, setInputUrl] = useState('')
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [webviewReady, setWebviewReady] = useState(false)
  const [otherTaskUrls, setOtherTaskUrls] = useState<TaskUrlEntry[]>([])
  const [importDropdownOpen, setImportDropdownOpen] = useState(false)
  const [reloadTrigger, setReloadTrigger] = useState(0)
  const webviewRef = useRef<WebviewElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Fetch URLs from other tasks when dropdown opens
  useEffect(() => {
    if (!importDropdownOpen || !taskId) return
    window.api.db.getTasks().then(tasks => {
      const entries: TaskUrlEntry[] = []
      for (const t of tasks) {
        if (t.id === taskId) continue
        if (!t.browser_tabs?.tabs) continue
        for (const tab of t.browser_tabs.tabs) {
          if (tab.url && tab.url !== 'about:blank') {
            entries.push({ taskId: t.id, taskTitle: t.title, url: tab.url, tabTitle: tab.title })
          }
        }
      }
      setOtherTaskUrls(entries)
    })
  }, [importDropdownOpen, taskId])

  const activeTab = tabs.tabs.find(t => t.id === tabs.activeTabId) || null

  // Multi-device state (derived from active tab)
  const multiDeviceMode = activeTab?.multiDeviceMode ?? false
  const [defaultConfig] = useState(defaultMultiDeviceConfig)
  const multiDeviceConfig = activeTab?.multiDeviceConfig ?? defaultConfig
  const multiDeviceLayout: GridLayout = activeTab?.multiDeviceLayout ?? 'horizontal'

  const updateActiveTab = useCallback((patch: Partial<BrowserTab>) => {
    if (!tabs.activeTabId) return
    onTabsChange({
      ...tabs,
      tabs: tabs.tabs.map(t =>
        t.id === tabs.activeTabId ? { ...t, ...patch } : t
      )
    })
  }, [tabs, onTabsChange])

  const toggleMultiDevice = useCallback(() => {
    if (!activeTab) return
    const entering = !multiDeviceMode
    if (!entering) setWebviewReady(false) // reset — single webview will remount
    updateActiveTab({
      multiDeviceMode: entering,
      ...(entering && !activeTab.multiDeviceConfig ? { multiDeviceConfig: defaultMultiDeviceConfig() } : {}),
      ...(entering && !activeTab.multiDeviceLayout ? { multiDeviceLayout: 'horizontal' as GridLayout } : {}),
    })
  }, [activeTab, multiDeviceMode, updateActiveTab])

  const setMultiDeviceLayout = useCallback((layout: GridLayout) => {
    updateActiveTab({ multiDeviceLayout: layout })
  }, [updateActiveTab])

  const setMultiDeviceConfig = useCallback((config: MultiDeviceConfig) => {
    updateActiveTab({ multiDeviceConfig: config })
  }, [updateActiveTab])

  const toggleSlot = useCallback((slot: DeviceSlot) => {
    const newConfig = { ...multiDeviceConfig, [slot]: { ...multiDeviceConfig[slot], enabled: !multiDeviceConfig[slot].enabled } }
    if (!Object.values(newConfig).some(c => c.enabled)) return
    setMultiDeviceConfig(newConfig)
  }, [multiDeviceConfig, setMultiDeviceConfig])

  const setPreset = useCallback((slot: DeviceSlot, preset: import('../shared').DeviceEmulation) => {
    setMultiDeviceConfig({ ...multiDeviceConfig, [slot]: { ...multiDeviceConfig[slot], preset } })
  }, [multiDeviceConfig, setMultiDeviceConfig])

  // Tab callbacks
  const createNewTab = useCallback((url = 'about:blank') => {
    const newTab: BrowserTab = {
      id: generateTabId(),
      url,
      title: url === 'about:blank' ? 'New Tab' : url
    }
    onTabsChange({
      tabs: [...tabs.tabs, newTab],
      activeTabId: newTab.id
    })
  }, [tabs, onTabsChange])

  const closeTab = useCallback((tabId: string) => {
    const idx = tabs.tabs.findIndex(t => t.id === tabId)
    const newTabs = tabs.tabs.filter(t => t.id !== tabId)

    let newActiveId = tabs.activeTabId
    if (tabId === tabs.activeTabId) {
      if (newTabs.length === 0) {
        const newTab: BrowserTab = { id: generateTabId(), url: 'about:blank', title: 'New Tab' }
        onTabsChange({ tabs: [newTab], activeTabId: newTab.id })
        return
      }
      newActiveId = newTabs[Math.min(idx, newTabs.length - 1)]?.id || null
    }

    onTabsChange({ tabs: newTabs, activeTabId: newActiveId })
  }, [tabs, onTabsChange])

  const switchToTab = useCallback((tabId: string) => {
    onTabsChange({ ...tabs, activeTabId: tabId })
  }, [tabs, onTabsChange])

  const switchToNextTab = useCallback(() => {
    const idx = tabs.tabs.findIndex(t => t.id === tabs.activeTabId)
    switchToTab(tabs.tabs[(idx + 1) % tabs.tabs.length].id)
  }, [tabs, switchToTab])

  const switchToPrevTab = useCallback(() => {
    const idx = tabs.tabs.findIndex(t => t.id === tabs.activeTabId)
    switchToTab(tabs.tabs[(idx - 1 + tabs.tabs.length) % tabs.tabs.length].id)
  }, [tabs, switchToTab])

  // Update URL bar when active tab changes
  useEffect(() => {
    setInputUrl(activeTab?.url || '')
  }, [activeTab?.id, activeTab?.url])

  // Load URL when active tab changes (single webview only)
  useEffect(() => {
    const wv = webviewRef.current
    if (!wv || !activeTab || !webviewReady || multiDeviceMode) return

    const currentUrl = wv.getURL()
    if (activeTab.url && activeTab.url !== currentUrl && activeTab.url !== 'about:blank') {
      wv.loadURL(activeTab.url.replace(/^file:\/\//, 'slz-file://'))
    }
  }, [activeTab?.id, webviewReady, multiDeviceMode])

  // Refs for stable event handler closures (avoids tearing down listeners on every tabs change)
  const tabsRef = useRef(tabs)
  const onTabsChangeRef = useRef(onTabsChange)
  const createNewTabRef = useRef(createNewTab)
  tabsRef.current = tabs
  onTabsChangeRef.current = onTabsChange
  createNewTabRef.current = createNewTab

  // Webview event listeners — attach once, read latest state via refs
  useEffect(() => {
    const wv = webviewRef.current
    if (!wv) return

    const handleNavigate = () => {
      setCanGoBack(wv.canGoBack())
      setCanGoForward(wv.canGoForward())
      const url = wv.getURL().replace(/^slz-file:\/\//, 'file://')
      setInputUrl(url)

      const t = tabsRef.current
      if (t.activeTabId) {
        onTabsChangeRef.current({
          ...t,
          tabs: t.tabs.map(tab =>
            tab.id === t.activeTabId ? { ...tab, url } : tab
          )
        })
      }
    }

    const handleStartLoading = () => setIsLoading(true)
    const handleStopLoading = () => setIsLoading(false)

    const handleTitleUpdate = (e: Event) => {
      const title = (e as CustomEvent).detail?.title || ''
      const t = tabsRef.current
      if (t.activeTabId && title) {
        onTabsChangeRef.current({
          ...t,
          tabs: t.tabs.map(tab =>
            tab.id === t.activeTabId ? { ...tab, title } : tab
          )
        })
      }
    }

    const handleFaviconUpdate = (e: Event) => {
      const favicons = (e as CustomEvent).detail?.favicons as string[] | undefined
      const favicon = favicons?.[0]
      const t = tabsRef.current
      if (t.activeTabId && favicon) {
        onTabsChangeRef.current({
          ...t,
          tabs: t.tabs.map(tab =>
            tab.id === t.activeTabId ? { ...tab, favicon } : tab
          )
        })
      }
    }

    const handleNewWindow = (e: Event) => {
      const url = (e as CustomEvent).detail?.url
      if (url) createNewTabRef.current(url)
    }

    const handleDomReady = () => setWebviewReady(true)

    wv.addEventListener('dom-ready', handleDomReady)
    wv.addEventListener('did-navigate', handleNavigate)
    wv.addEventListener('did-navigate-in-page', handleNavigate)
    wv.addEventListener('did-start-loading', handleStartLoading)
    wv.addEventListener('did-stop-loading', handleStopLoading)
    wv.addEventListener('page-title-updated', handleTitleUpdate)
    wv.addEventListener('page-favicon-updated', handleFaviconUpdate)
    wv.addEventListener('new-window', handleNewWindow)

    return () => {
      wv.removeEventListener('dom-ready', handleDomReady)
      wv.removeEventListener('did-navigate', handleNavigate)
      wv.removeEventListener('did-navigate-in-page', handleNavigate)
      wv.removeEventListener('did-start-loading', handleStartLoading)
      wv.removeEventListener('did-stop-loading', handleStopLoading)
      wv.removeEventListener('page-title-updated', handleTitleUpdate)
      wv.removeEventListener('page-favicon-updated', handleFaviconUpdate)
      wv.removeEventListener('new-window', handleNewWindow)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- stable via refs

  // Keyboard shortcuts when focused
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isFocused) return
      if (e.metaKey && e.key === 't') { e.preventDefault(); createNewTab() }
      if (e.metaKey && e.key === 'w') { e.preventDefault(); if (tabs.activeTabId) closeTab(tabs.activeTabId) }
      if (e.ctrlKey && e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); switchToNextTab() }
      if (e.ctrlKey && e.key === 'Tab' && e.shiftKey) { e.preventDefault(); switchToPrevTab() }
    }

    container.addEventListener('keydown', handleKeyDown)
    return () => container.removeEventListener('keydown', handleKeyDown)
  }, [isFocused, tabs, createNewTab, closeTab, switchToNextTab, switchToPrevTab])

  const handleNavigate = () => {
    if (!inputUrl.trim()) return

    let url = inputUrl.trim()
    if (url.startsWith('/')) {
      url = `file://${url}`
    } else if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('file://')) {
      url = `https://${url}`
    }

    if (multiDeviceMode) {
      setInputUrl(url)
      updateActiveTab({ url })
      return
    }

    const wv = webviewRef.current
    if (!wv) return
    if (url.startsWith('file://')) {
      url = url.replace('file://', 'slz-file://')
    }
    wv.loadURL(url)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleNavigate()
  }

  const handleFocus = () => setIsFocused(true)
  const handleBlur = (e: React.FocusEvent) => {
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setIsFocused(false)
    }
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex flex-col rounded-md transition-shadow',
        isFocused && 'ring-2 ring-blue-500/50',
        className
      )}
      tabIndex={-1}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      {/* Tab Bar */}
      <div className="shrink-0 flex items-center h-10 px-2 gap-1 border-b border-border overflow-x-auto scrollbar-hide">
        {tabs.tabs.map(tab => {
          const isActive = tab.id === tabs.activeTabId
          const displayUrl = tab.url === 'about:blank' ? 'New Tab' : tab.url
          return (
            <div
              key={tab.id}
              role="button"
              tabIndex={0}
              onClick={() => switchToTab(tab.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); switchToTab(tab.id) }
              }}
              onAuxClick={(e) => {
                if (e.button === 1) { e.preventDefault(); closeTab(tab.id) }
              }}
              className={cn(
                'group flex items-center gap-1.5 h-7 px-3 rounded-md cursor-pointer transition-colors select-none flex-shrink-0',
                'bg-neutral-100 dark:bg-neutral-800/50 hover:bg-neutral-200/80 dark:hover:bg-neutral-700/50',
                'min-w-[150px] max-w-[300px]',
                isActive ? 'bg-neutral-200 dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600' : 'text-neutral-500 dark:text-neutral-400'
              )}
            >
              <span className="truncate text-sm">{displayUrl}</span>
              <button
                onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
                className="h-4 w-4 rounded hover:bg-muted-foreground/20 flex items-center justify-center"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )
        })}
        <button
          onClick={() => createNewTab()}
          className="h-7 px-2 rounded-md hover:bg-neutral-200/80 dark:hover:bg-neutral-700/50 text-neutral-500 dark:text-neutral-400 flex items-center"
        >
          <Plus className="size-4" />
        </button>
      </div>

      {/* URL Bar */}
      <div className="shrink-0 p-2 border-b flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" disabled={!canGoBack || multiDeviceMode} onClick={() => webviewRef.current?.goBack()}>
          <ArrowLeft className="size-4" />
        </Button>
        <Button variant="ghost" size="icon-sm" disabled={!canGoForward || multiDeviceMode} onClick={() => webviewRef.current?.goForward()}>
          <ArrowRight className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            if (multiDeviceMode) setReloadTrigger(r => r + 1)
            else if (isLoading) webviewRef.current?.stop()
            else webviewRef.current?.reload()
          }}
        >
          {isLoading && !multiDeviceMode ? <X className="size-4" /> : <RotateCw className="size-4" />}
        </Button>

        <Input
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter URL..."
          className="flex-1 h-7 text-sm"
        />

        <Button
          variant="ghost"
          size="icon-sm"
          className={cn(multiDeviceMode && 'text-blue-500 bg-blue-500/10')}
          title={multiDeviceMode ? 'Exit responsive preview' : 'Responsive preview'}
          onClick={toggleMultiDevice}
        >
          <LayoutGrid className="size-4" />
        </Button>

        {taskId && (
          <DropdownMenu open={importDropdownOpen} onOpenChange={setImportDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm">
                <Import className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-64 overflow-y-auto w-80">
              {otherTaskUrls.length === 0 ? (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                  No URLs from other tasks
                </div>
              ) : (
                otherTaskUrls.map((entry, idx) => (
                  <DropdownMenuItem
                    key={`${entry.taskId}-${idx}`}
                    onClick={() => {
                      if (multiDeviceMode) {
                        updateActiveTab({ url: entry.url })
                        setInputUrl(entry.url)
                      } else {
                        webviewRef.current?.loadURL(entry.url)
                      }
                    }}
                    className="flex flex-col items-start gap-0.5"
                  >
                    <span className="text-xs text-muted-foreground truncate w-full">
                      {entry.taskTitle}
                    </span>
                    <span className="text-sm truncate w-full">{entry.url}</span>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Responsive toolbar */}
      {multiDeviceMode && (
        <div className="shrink-0 flex items-center py-2 px-2 gap-3 border-b border-border bg-neutral-900">
          {/* Device toggle buttons */}
          {SLOT_BUTTONS.map(({ slot, icon: Icon, label }) => {
            const enabled = multiDeviceConfig[slot].enabled
            return (
              <button
                key={slot}
                onClick={() => toggleSlot(slot)}
                className={cn(
                  'h-8 px-3 flex items-center gap-1.5 text-xs font-medium rounded-lg border transition-colors',
                  enabled
                    ? 'text-blue-400 bg-blue-500/15 border-blue-500/30 hover:bg-blue-500/25'
                    : 'text-neutral-500 border-neutral-700 hover:text-neutral-300 hover:bg-neutral-800'
                )}
              >
                <Icon className="size-3.5" />
                <span>{label}</span>
              </button>
            )
          })}
          <div className="flex-1" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 px-2 text-xs text-neutral-500 hover:text-neutral-300 gap-1">
                {multiDeviceLayout === 'horizontal' ? 'Side by side' : 'Stacked'}
                <ChevronDown className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => setMultiDeviceLayout('horizontal')}
                className={cn(multiDeviceLayout === 'horizontal' && 'text-blue-500 font-medium')}
              >
                Side by side
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setMultiDeviceLayout('vertical')}
                className={cn(multiDeviceLayout === 'vertical' && 'text-blue-500 font-medium')}
              >
                Stacked
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Webview / Multi-device */}
      {multiDeviceMode ? (
        <MultiDeviceGrid
          config={multiDeviceConfig}
          layout={multiDeviceLayout}
          url={activeTab?.url || 'about:blank'}
          isResizing={isResizing}
          reloadTrigger={reloadTrigger}
          onPresetChange={setPreset}
        />
      ) : (
        <div className="relative flex-1">
          <webview
            ref={webviewRef}
            src={(activeTab?.url || 'about:blank').replace(/^file:\/\//, 'slz-file://')}
            partition="persist:browser-tabs"
            className="absolute inset-0"
            // @ts-expect-error - webview attributes not in React types
            allowpopups="true"
          />
          {isResizing && <div className="absolute inset-0 z-10" />}
        </div>
      )}
    </div>
  )
}
