import { useRef, useEffect, useCallback, useState } from 'react'
import { RotateCw, X, Globe, Monitor, Tablet, Smartphone } from 'lucide-react'
import { Button, cn } from '@slayzone/ui'
import type { WebPanelEnvironment, WebPanelResolution, WebPanelResolutionDefaults } from '../shared/types'
import { useWebPanelEmulation } from './useWebPanelEmulation'

interface WebviewElement extends HTMLElement {
  reload(): void
  stop(): void
  getURL(): string
  getWebContentsId(): number
}

interface WebPanelViewProps {
  panelId: string
  url: string
  name: string
  onUrlChange: (panelId: string, url: string) => void
  onFaviconChange?: (panelId: string, favicon: string) => void
  isResizing?: boolean
  resolution?: WebPanelResolution | null
  resolutionDefaults?: WebPanelResolutionDefaults
  onResolutionChange?: (panelId: string, resolution: WebPanelResolution | null) => void
}

const ENV_BUTTONS: { env: WebPanelEnvironment; icon: typeof Monitor; label: string }[] = [
  { env: 'desktop', icon: Monitor, label: 'Desktop' },
  { env: 'tablet', icon: Tablet, label: 'Tablet' },
  { env: 'mobile', icon: Smartphone, label: 'Mobile' },
]

export function WebPanelView({
  panelId, url, name, onUrlChange, onFaviconChange, isResizing,
  resolution, resolutionDefaults, onResolutionChange,
}: WebPanelViewProps) {
  const webviewRef = useRef<WebviewElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [webviewReady, setWebviewReady] = useState(false)
  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(null)

  const handleResolutionChange = useCallback((res: WebPanelResolution | null) => {
    onResolutionChange?.(panelId, res)
  }, [panelId, onResolutionChange])

  const {
    environment, setEnvironment, resetToDefaults,
    effectiveSize, scale, dragSize,
    handleResizeStart, isResizeDragging,
  } = useWebPanelEmulation({
    webviewRef,
    webviewReady,
    resolution: resolution ?? null,
    defaults: resolutionDefaults,
    containerSize,
    onResolutionChange: handleResolutionChange,
  })

  // Track webview ready
  useEffect(() => {
    const wv = webviewRef.current
    if (!wv) return
    const onReady = () => setWebviewReady(true)
    wv.addEventListener('dom-ready', onReady)
    return () => wv.removeEventListener('dom-ready', onReady)
  }, [])

  // Track container size
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setContainerSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const handleNavigate = useCallback(() => {
    const wv = webviewRef.current
    if (!wv) return
    onUrlChange(panelId, wv.getURL())
  }, [panelId, onUrlChange])

  useEffect(() => {
    const wv = webviewRef.current
    if (!wv) return

    const onStartLoading = () => setIsLoading(true)
    const onStopLoading = () => setIsLoading(false)

    const onFavicon = (e: Event) => {
      const favicons = (e as CustomEvent).detail?.favicons as string[] | undefined
      if (favicons?.[0] && onFaviconChange) {
        onFaviconChange(panelId, favicons[0])
      }
    }

    wv.addEventListener('did-navigate', handleNavigate)
    wv.addEventListener('did-navigate-in-page', handleNavigate)
    wv.addEventListener('did-start-loading', onStartLoading)
    wv.addEventListener('did-stop-loading', onStopLoading)
    wv.addEventListener('page-favicon-updated', onFavicon)

    return () => {
      wv.removeEventListener('did-navigate', handleNavigate)
      wv.removeEventListener('did-navigate-in-page', handleNavigate)
      wv.removeEventListener('did-start-loading', onStartLoading)
      wv.removeEventListener('did-stop-loading', onStopLoading)
      wv.removeEventListener('page-favicon-updated', onFavicon)
    }
  }, [handleNavigate, panelId, onFaviconChange])

  const emW = dragSize?.width ?? effectiveSize?.width ?? 0
  const emH = dragSize?.height ?? effectiveSize?.height ?? 0

  return (
    <div className="flex flex-col h-full">
      {/* Header — h-10 matches Terminal/Browser/Editor tab bars */}
      <div className="shrink-0 flex items-center h-10 px-2 gap-1.5 border-b border-border">
        <Globe className="size-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs font-medium text-muted-foreground flex-1">{name}</span>

        {onResolutionChange && (
          <div className="flex items-center gap-0.5">
            {ENV_BUTTONS.map(({ env, icon: Icon, label }) => (
              <Button
                key={env}
                variant="ghost"
                size="icon-sm"
                title={environment === env ? `${label} (double-click to reset)` : label}
                className={cn(
                  environment === env && 'text-blue-500 bg-blue-500/10'
                )}
                onClick={() => {
                  if (environment === env) setEnvironment(null)
                  else setEnvironment(env)
                }}
                onDoubleClick={() => {
                  if (environment === env) resetToDefaults()
                }}
              >
                <Icon className="size-3.5" />
              </Button>
            ))}
          </div>
        )}

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            const wv = webviewRef.current
            if (!wv) return
            if (isLoading) wv.stop()
            else wv.reload()
          }}
        >
          {isLoading ? <X className="size-3.5" /> : <RotateCw className="size-3.5" />}
        </Button>
      </div>

      {/* Webview */}
      <div
        ref={containerRef}
        className={cn(
          'relative flex-1',
          environment && 'flex items-center justify-center bg-neutral-900 overflow-hidden'
        )}
      >
        <div
          className={cn('relative', !environment && 'absolute inset-0')}
          style={environment ? {
            width: emW * scale,
            height: emH * scale,
          } : undefined}
        >
          <div
            className={cn('absolute', environment && 'border border-neutral-700 origin-top-left')}
            style={environment ? {
              width: emW,
              height: emH,
              transform: scale < 1 ? `scale(${scale})` : undefined,
              top: 0,
              left: 0,
            } : { inset: 0 }}
          >
            <webview
              ref={webviewRef}
              src={url}
              partition="persist:web-panels"
              className="absolute inset-0"
              // @ts-expect-error - webview attributes not in React types
              allowpopups="true"
            />
          </div>
          {environment && (
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
          {(dragSize || isResizing || isResizeDragging) && <div className="absolute inset-0 z-10" />}
        </div>
        {environment && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-neutral-500 pointer-events-none">
            {emW}&times;{emH}
          </div>
        )}
      </div>
    </div>
  )
}
