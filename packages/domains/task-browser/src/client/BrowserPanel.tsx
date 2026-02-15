import { useState, useRef, useEffect, useCallback } from 'react'
import { ArrowLeft, ArrowRight, RotateCw, X, Plus, Import, Smartphone } from 'lucide-react'
import {
  Button,
  Input,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Separator,
} from '@slayzone/ui'
import type { BrowserTab, BrowserTabsState, DeviceEmulation } from '../shared'
import { DEVICE_PRESETS } from './device-presets'
import { computeScale } from './scale'

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
  const [customWidth, setCustomWidth] = useState('375')
  const [customHeight, setCustomHeight] = useState('667')
  const [viewportSize, setViewportSize] = useState<{ width: number; height: number } | null>(null)
  const webviewRef = useRef<WebviewElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)

  // Track viewport container size for scale-to-fit
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setViewportSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

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
            entries.push({
              taskId: t.id,
              taskTitle: t.title,
              url: tab.url,
              tabTitle: tab.title
            })
          }
        }
      }
      setOtherTaskUrls(entries)
    })
  }, [importDropdownOpen, taskId])

  const activeTab = tabs.tabs.find(t => t.id === tabs.activeTabId) || null

  // Define callbacks first so they can be used in useEffects
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

    // If closing active tab, switch to adjacent tab
    let newActiveId = tabs.activeTabId
    if (tabId === tabs.activeTabId) {
      if (newTabs.length === 0) {
        // Create a new blank tab if closing last one
        const newTab: BrowserTab = {
          id: generateTabId(),
          url: 'about:blank',
          title: 'New Tab'
        }
        onTabsChange({
          tabs: [newTab],
          activeTabId: newTab.id
        })
        return
      }
      newActiveId = newTabs[Math.min(idx, newTabs.length - 1)]?.id || null
    }

    onTabsChange({
      tabs: newTabs,
      activeTabId: newActiveId
    })
  }, [tabs, onTabsChange])

  const switchToTab = useCallback((tabId: string) => {
    onTabsChange({
      ...tabs,
      activeTabId: tabId
    })
  }, [tabs, onTabsChange])

  const switchToNextTab = useCallback(() => {
    const idx = tabs.tabs.findIndex(t => t.id === tabs.activeTabId)
    const nextIdx = (idx + 1) % tabs.tabs.length
    switchToTab(tabs.tabs[nextIdx].id)
  }, [tabs, switchToTab])

  const switchToPrevTab = useCallback(() => {
    const idx = tabs.tabs.findIndex(t => t.id === tabs.activeTabId)
    const prevIdx = (idx - 1 + tabs.tabs.length) % tabs.tabs.length
    switchToTab(tabs.tabs[prevIdx].id)
  }, [tabs, switchToTab])

  // Update URL bar when active tab changes
  useEffect(() => {
    setInputUrl(activeTab?.url || '')
  }, [activeTab?.id, activeTab?.url])

  // Load URL when active tab changes
  useEffect(() => {
    const wv = webviewRef.current
    if (!wv || !activeTab || !webviewReady) return

    const currentUrl = wv.getURL()
    if (activeTab.url && activeTab.url !== currentUrl && activeTab.url !== 'about:blank') {
      wv.loadURL(activeTab.url)
    }
  }, [activeTab?.id, webviewReady])

  // Webview event listeners
  useEffect(() => {
    const wv = webviewRef.current
    if (!wv) return

    const handleNavigate = () => {
      setCanGoBack(wv.canGoBack())
      setCanGoForward(wv.canGoForward())
      const url = wv.getURL()
      setInputUrl(url)

      // Update tab URL
      if (tabs.activeTabId) {
        onTabsChange({
          ...tabs,
          tabs: tabs.tabs.map(t =>
            t.id === tabs.activeTabId ? { ...t, url } : t
          )
        })
      }
    }

    const handleStartLoading = () => setIsLoading(true)
    const handleStopLoading = () => setIsLoading(false)

    const handleTitleUpdate = (e: Event) => {
      const title = (e as CustomEvent).detail?.title || ''
      if (tabs.activeTabId && title) {
        onTabsChange({
          ...tabs,
          tabs: tabs.tabs.map(t =>
            t.id === tabs.activeTabId ? { ...t, title } : t
          )
        })
      }
    }

    const handleFaviconUpdate = (e: Event) => {
      const favicons = (e as CustomEvent).detail?.favicons as string[] | undefined
      const favicon = favicons?.[0]
      if (tabs.activeTabId && favicon) {
        onTabsChange({
          ...tabs,
          tabs: tabs.tabs.map(t =>
            t.id === tabs.activeTabId ? { ...t, favicon } : t
          )
        })
      }
    }

    // Handle middle-click / cmd+click opening new tab
    const handleNewWindow = (e: Event) => {
      const url = (e as CustomEvent).detail?.url
      if (url) {
        createNewTab(url)
      }
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
  }, [tabs, onTabsChange, createNewTab])

  // Apply/disable device emulation when tab or emulation changes
  const activeEmulation = activeTab?.deviceEmulation ?? null
  const prevEmulationRef = useRef<{ tabId: string | null; width: number; height: number; dpr: number; mobile: boolean; ua?: string } | null>(null)
  const mountedRef = useRef(false)

  useEffect(() => {
    const wv = webviewRef.current
    if (!wv || !webviewReady) return

    const cur = activeEmulation ? {
      tabId: activeTab?.id ?? null,
      width: activeEmulation.width,
      height: activeEmulation.height,
      dpr: activeEmulation.deviceScaleFactor,
      mobile: activeEmulation.mobile,
      ua: activeEmulation.userAgent,
    } : null
    const prev = prevEmulationRef.current

    // Skip initial mount with no emulation
    if (!mountedRef.current) {
      mountedRef.current = true
      if (!cur) {
        prevEmulationRef.current = null
        return
      }
    }

    // Skip if nothing meaningful changed
    if (cur && prev &&
      cur.tabId === prev.tabId &&
      cur.width === prev.width &&
      cur.height === prev.height &&
      cur.dpr === prev.dpr &&
      cur.mobile === prev.mobile &&
      cur.ua === prev.ua
    ) return

    const prevUa = prev?.ua
    prevEmulationRef.current = cur

    const wcId = wv.getWebContentsId()
    if (activeEmulation) {
      window.api.webview?.enableDeviceEmulation(wcId, {
        screenSize: { width: activeEmulation.width, height: activeEmulation.height },
        viewSize: { width: activeEmulation.width, height: activeEmulation.height },
        deviceScaleFactor: activeEmulation.deviceScaleFactor,
        screenPosition: activeEmulation.mobile ? 'mobile' : 'desktop',
        userAgent: activeEmulation.userAgent,
      }).then(() => {
        // Only reload if UA changed — viewport changes apply instantly
        if (activeEmulation.userAgent !== prevUa) wv.reload()
      })
    } else {
      window.api.webview?.disableDeviceEmulation(wcId).then(() => {
        if (prevUa) wv.reload()
      })
    }
  }, [activeEmulation, webviewReady, activeTab?.id])

  const setEmulation = useCallback((emulation: DeviceEmulation | null) => {
    if (!tabs.activeTabId) return
    onTabsChange({
      ...tabs,
      tabs: tabs.tabs.map(t =>
        t.id === tabs.activeTabId ? { ...t, deviceEmulation: emulation } : t
      )
    })
  }, [tabs, onTabsChange])

  // Resize handles drag state
  const [dragSize, setDragSize] = useState<{ width: number; height: number } | null>(null)
  const [dragScale, setDragScale] = useState<number | null>(null)
  const dragRef = useRef<{ startX: number; startY: number; startW: number; startH: number; axis: 'x' | 'y' | 'xy'; latestW: number; latestH: number } | null>(null)
  const dragCleanupRef = useRef<(() => void) | null>(null)

  // Clean up drag listeners on unmount
  useEffect(() => {
    return () => { dragCleanupRef.current?.() }
  }, [])

  const handleResizeStart = useCallback((e: React.MouseEvent, axis: 'x' | 'y' | 'xy') => {
    if (!activeEmulation) return
    e.preventDefault()
    const startW = activeEmulation.width
    const startH = activeEmulation.height
    // Freeze scale during drag so the handle tracks the mouse
    const frozen = computeScale(viewportSize, { width: startW, height: startH })
    setDragScale(frozen)
    dragRef.current = { startX: e.clientX, startY: e.clientY, startW, startH, axis, latestW: startW, latestH: startH }

    const onMove = (ev: MouseEvent) => {
      const d = dragRef.current
      if (!d) return
      const dx = ev.clientX - d.startX
      const dy = ev.clientY - d.startY
      d.latestW = Math.max(200, d.axis !== 'y' ? d.startW + dx : d.startW)
      d.latestH = Math.max(200, d.axis !== 'x' ? d.startH + dy : d.startH)
      setDragSize({ width: d.latestW, height: d.latestH })
    }

    const cleanup = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      dragCleanupRef.current = null
    }

    const onUp = () => {
      cleanup()
      const d = dragRef.current
      dragRef.current = null
      if (d && activeEmulation) {
        setEmulation({
          name: 'Custom',
          width: d.latestW,
          height: d.latestH,
          deviceScaleFactor: activeEmulation.deviceScaleFactor,
          mobile: activeEmulation.mobile,
          userAgent: activeEmulation.userAgent,
        })
      }
      setDragSize(null)
      setDragScale(null)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    dragCleanupRef.current = cleanup
  }, [activeEmulation, setEmulation, viewportSize])

  // Keyboard shortcuts when focused
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isFocused) return

      // Cmd+T: New tab
      if (e.metaKey && e.key === 't') {
        e.preventDefault()
        createNewTab()
      }
      // Cmd+W: Close tab
      if (e.metaKey && e.key === 'w') {
        e.preventDefault()
        if (tabs.activeTabId) {
          closeTab(tabs.activeTabId)
        }
      }
      // Ctrl+Tab: Next tab
      if (e.ctrlKey && e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault()
        switchToNextTab()
      }
      // Ctrl+Shift+Tab: Prev tab
      if (e.ctrlKey && e.key === 'Tab' && e.shiftKey) {
        e.preventDefault()
        switchToPrevTab()
      }
    }

    container.addEventListener('keydown', handleKeyDown)
    return () => container.removeEventListener('keydown', handleKeyDown)
  }, [isFocused, tabs, createNewTab, closeTab, switchToNextTab, switchToPrevTab])

  const handleNavigate = () => {
    const wv = webviewRef.current
    if (!wv || !inputUrl.trim()) return

    let url = inputUrl.trim()
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`
    }
    wv.loadURL(url)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNavigate()
    }
  }

  const handleFocus = () => setIsFocused(true)
  const handleBlur = (e: React.FocusEvent) => {
    // Only blur if focus is leaving the container entirely
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
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  switchToTab(tab.id)
                }
              }}
              onAuxClick={(e) => {
                if (e.button === 1) {
                  e.preventDefault()
                  closeTab(tab.id)
                }
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
                onClick={(e) => {
                  e.stopPropagation()
                  closeTab(tab.id)
                }}
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
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={!canGoBack}
          onClick={() => webviewRef.current?.goBack()}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={!canGoForward}
          onClick={() => webviewRef.current?.goForward()}
        >
          <ArrowRight className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            if (isLoading) {
              webviewRef.current?.stop()
            } else {
              webviewRef.current?.reload()
            }
          }}
        >
          {isLoading ? <X className="size-4" /> : <RotateCw className="size-4" />}
        </Button>

        <Input
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter URL..."
          className="flex-1 h-7 text-sm"
        />

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className={cn(activeEmulation && 'text-blue-500 bg-blue-500/10')}
            >
              <Smartphone className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-1" align="end">
            <button
              onClick={() => setEmulation(null)}
              className={cn(
                'w-full text-left px-2 py-1.5 text-sm rounded-sm hover:bg-accent',
                !activeEmulation && 'text-blue-500 font-medium'
              )}
            >
              No emulation
            </button>
            <Separator className="my-1" />
            {DEVICE_PRESETS.map(preset => (
              <button
                key={preset.name}
                onClick={() => setEmulation(preset)}
                className={cn(
                  'w-full text-left px-2 py-1 text-sm rounded-sm hover:bg-accent flex items-center justify-between',
                  activeEmulation?.name === preset.name && 'text-blue-500 font-medium'
                )}
              >
                <span>{preset.name}</span>
                <span className="text-xs text-muted-foreground">{preset.width}&times;{preset.height}</span>
              </button>
            ))}
            <Separator className="my-1" />
            <div className="flex gap-1 items-center px-2 py-1">
              <Input
                value={customWidth}
                onChange={(e) => setCustomWidth(e.target.value)}
                className="w-16 h-6 text-xs"
                placeholder="W"
              />
              <span className="text-xs text-muted-foreground">&times;</span>
              <Input
                value={customHeight}
                onChange={(e) => setCustomHeight(e.target.value)}
                className="w-16 h-6 text-xs"
                placeholder="H"
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => {
                  const w = parseInt(customWidth, 10)
                  const h = parseInt(customHeight, 10)
                  if (w > 0 && h > 0) {
                    setEmulation({ name: 'Custom', width: w, height: h, deviceScaleFactor: 1, mobile: false })
                  }
                }}
              >
                Apply
              </Button>
            </div>
          </PopoverContent>
        </Popover>

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
                    onClick={() => webviewRef.current?.loadURL(entry.url)}
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

      {/* Webview */}
      <div
        ref={viewportRef}
        className={cn(
          'relative flex-1',
          activeEmulation && 'flex items-center justify-center bg-neutral-900 overflow-hidden'
        )}
      >
        {(() => {
          const emW = dragSize?.width ?? activeEmulation?.width ?? 0
          const emH = dragSize?.height ?? activeEmulation?.height ?? 0
          const scale = dragScale ?? computeScale(viewportSize, activeEmulation ? { width: emW, height: emH } : null)
          return (
        <div
          className={cn('relative', !activeEmulation && 'absolute inset-0')}
          style={activeEmulation ? {
            width: emW * scale,
            height: emH * scale,
          } : undefined}
        >
          {/* Webview content — scaled to fit when device is larger than container */}
          <div
            className={cn('absolute', activeEmulation && 'border border-neutral-700 origin-top-left')}
            style={activeEmulation ? {
              width: emW,
              height: emH,
              transform: scale < 1 ? `scale(${scale})` : undefined,
              top: 0,
              left: 0,
            } : { inset: 0 }}
          >
            <webview
              ref={webviewRef}
              src={activeTab?.url || 'about:blank'}
              partition="persist:browser-tabs"
              className="absolute inset-0"
              // @ts-expect-error - webview attributes not in React types
              allowpopups="true"
            />
          </div>
          {activeEmulation && (
            <>
              {/* Right handle */}
              <div
                className="absolute top-0 -right-8 w-10 cursor-ew-resize group flex items-center justify-center"
                style={{ height: 'calc(100% - 2rem)' }}
                onMouseDown={(e) => handleResizeStart(e, 'x')}
              >
                <div className="w-1 h-8 rounded-full bg-neutral-600 group-hover:bg-blue-500 transition-colors" />
              </div>
              {/* Bottom handle */}
              <div
                className="absolute -bottom-8 left-0 h-10 cursor-ns-resize group flex items-center justify-center"
                style={{ width: 'calc(100% - 2rem)' }}
                onMouseDown={(e) => handleResizeStart(e, 'y')}
              >
                <div className="h-1 w-8 rounded-full bg-neutral-600 group-hover:bg-blue-500 transition-colors" />
              </div>
              {/* Corner handle */}
              <div
                className="absolute -bottom-8 -right-8 w-10 h-10 cursor-nwse-resize group"
                onMouseDown={(e) => handleResizeStart(e, 'xy')}
              >
                <div className="absolute top-0 w-1 h-1/2 rounded-full bg-neutral-600 group-hover:bg-blue-500 transition-colors" style={{ left: 'calc(50% - 2px)', transform: 'translateX(-50%)' }} />
                <div className="absolute left-0 h-1 w-1/2 rounded-full bg-neutral-600 group-hover:bg-blue-500 transition-colors" style={{ top: 'calc(50% - 2px)', transform: 'translateY(-50%)' }} />
              </div>
            </>
          )}
          {(dragSize || isResizing) && <div className="absolute inset-0 z-10" />}
        </div>
          )
        })()}
        {activeEmulation && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-neutral-500 pointer-events-none">
            {activeEmulation.name} — {dragSize?.width ?? activeEmulation.width}&times;{dragSize?.height ?? activeEmulation.height}
          </div>
        )}
      </div>
    </div>
  )
}
