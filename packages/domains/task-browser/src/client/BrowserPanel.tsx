import { useState, useRef, useEffect, useCallback } from 'react'
import { ArrowLeft, ArrowRight, RotateCw, X, Plus } from 'lucide-react'
import { Button, Input, cn } from '@omgslayzone/ui'
import type { BrowserTab, BrowserTabsState } from '../shared'

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
}

interface BrowserPanelProps {
  className?: string
  tabs: BrowserTabsState
  onTabsChange: (tabs: BrowserTabsState) => void
}

function generateTabId(): string {
  return `tab-${crypto.randomUUID().slice(0, 8)}`
}

export function BrowserPanel({ className, tabs, onTabsChange }: BrowserPanelProps) {
  const [inputUrl, setInputUrl] = useState('')
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [webviewReady, setWebviewReady] = useState(false)
  const webviewRef = useRef<WebviewElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

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
      <div className="shrink-0 flex items-end h-10 px-2 pt-2 gap-1 bg-background border-b overflow-x-auto">
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
                'group flex items-center gap-1.5 h-8 px-3 rounded-t-md cursor-pointer transition-colors select-none flex-shrink-0',
                'hover:bg-muted/50',
                'min-w-[150px] max-w-[300px]',
                isActive ? 'bg-muted border-b-2 border-b-primary' : 'text-muted-foreground'
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
          className="h-8 px-2 rounded-t-md hover:bg-muted/50 text-muted-foreground flex items-center"
        >
          <Plus className="size-4" />
        </button>
      </div>

      {/* URL Bar */}
      <div className="shrink-0 p-2 border-b flex items-center gap-1 bg-background">
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
      </div>

      {/* Webview */}
      <webview
        ref={webviewRef}
        src={activeTab?.url || 'about:blank'}
        partition="persist:browser-tabs"
        className="flex-1"
        // @ts-expect-error - webview attributes not in React types
        allowpopups="true"
      />
    </div>
  )
}
