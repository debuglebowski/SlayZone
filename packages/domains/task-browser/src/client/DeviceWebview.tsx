import { useRef, useState, useEffect } from 'react'
import type { DeviceEmulation } from '../shared'

interface WebviewElement extends HTMLElement {
  reload(): void
  reloadIgnoringCache(): void
  stop(): void
  loadURL(url: string): void
  getURL(): string
  getWebContentsId(): number
  executeJavaScript(code: string): Promise<string>
}

export interface DeviceLayout {
  topOffset: number
  scaledHeight: number
  width: number
}

interface DeviceWebviewProps {
  url: string
  preset: DeviceEmulation
  partition: string
  isResizing?: boolean
  reloadTrigger?: number
  forceReloadTrigger?: number
  onLayout?: (layout: DeviceLayout) => void
}

export function DeviceWebview({ url, preset, partition, isResizing, reloadTrigger, forceReloadTrigger, onLayout }: DeviceWebviewProps) {
  const webviewRef = useRef<WebviewElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [webviewReady, setWebviewReady] = useState(false)
  const [webviewKey, setWebviewKey] = useState(0)
  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(null)
  const prevEmulationRef = useRef<{ w: number; h: number; dpr: number; mobile: boolean; ua?: string } | null>(null)
  const hasRemountedRef = useRef(false)

  const [initialSrc] = useState(() => (url || 'about:blank').replace(/^file:\/\//, 'slz-file://'))
  const loadedUrlRef = useRef(url)

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

  // Webview dom-ready
  useEffect(() => {
    const wv = webviewRef.current
    if (!wv) return
    const handleDomReady = () => {
      setWebviewReady(true)
    }
    wv.addEventListener('dom-ready', handleDomReady)
    return () => wv.removeEventListener('dom-ready', handleDomReady)
  }, [containerSize !== null])

  const widthScale = containerSize ? Math.min(1, containerSize.width / preset.width) : 1

  // Apply device emulation when preset changes
  useEffect(() => {
    const wv = webviewRef.current
    if (!wv || !webviewReady) return

    const cur = { w: preset.width, h: preset.height, dpr: preset.deviceScaleFactor, mobile: preset.mobile, ua: preset.userAgent }
    const prev = prevEmulationRef.current
    if (prev && cur.w === prev.w && cur.h === prev.h && cur.dpr === prev.dpr && cur.mobile === prev.mobile && cur.ua === prev.ua) return

    const prevUa = prev?.ua
    prevEmulationRef.current = cur

    const wcId = wv.getWebContentsId()
    window.api.webview?.enableDeviceEmulation(wcId, {
      screenSize: { width: preset.width, height: preset.height },
      viewSize: { width: preset.width, height: preset.height },
      deviceScaleFactor: preset.deviceScaleFactor,
      screenPosition: preset.mobile ? 'mobile' : 'desktop',
      userAgent: preset.userAgent,
    }).then(() => {
      if (preset.userAgent !== prevUa) wv.reload()

      // Force one-time webview remount to fix Chromium BrowserPlugin surface clipping under CSS transform
      if (!prev && !hasRemountedRef.current) {
        hasRemountedRef.current = true
        setTimeout(() => {
          prevEmulationRef.current = null
          setWebviewKey(k => k + 1)
          setWebviewReady(false)
        }, 100)
      }
    })
  }, [preset, webviewReady])

  // Navigate only when parent URL actually changes
  useEffect(() => {
    const wv = webviewRef.current
    if (!wv || !webviewReady || !url || url === 'about:blank') return
    if (url === loadedUrlRef.current) return
    loadedUrlRef.current = url
    wv.loadURL(url.replace(/^file:\/\//, 'slz-file://'))
  }, [url, webviewReady])

  // Reload when trigger increments
  const prevReloadRef = useRef(reloadTrigger)
  useEffect(() => {
    if (reloadTrigger !== prevReloadRef.current) {
      prevReloadRef.current = reloadTrigger
      if (webviewReady) webviewRef.current?.reload()
    }
  }, [reloadTrigger, webviewReady])

  // Force reload (ignore cache) when trigger increments
  const prevForceReloadRef = useRef(forceReloadTrigger)
  useEffect(() => {
    if (forceReloadTrigger !== prevForceReloadRef.current) {
      prevForceReloadRef.current = forceReloadTrigger
      if (webviewReady) webviewRef.current?.reloadIgnoringCache()
    }
  }, [forceReloadTrigger, webviewReady])

  // Disable emulation on unmount
  useEffect(() => {
    return () => {
      const wv = webviewRef.current
      if (wv && webviewReady) {
        try {
          const wcId = wv.getWebContentsId()
          window.api.webview?.disableDeviceEmulation(wcId)
        } catch { /* webview may be destroyed */ }
      }
    }
  }, [webviewReady])

  const scaledHeight = preset.height * widthScale
  const topOffset = containerSize ? Math.max(0, (containerSize.height - scaledHeight) / 2) : 0

  const onLayoutRef = useRef(onLayout)
  onLayoutRef.current = onLayout
  const containerW = containerSize?.width ?? 0
  useEffect(() => {
    if (containerW) onLayoutRef.current?.({ topOffset, scaledHeight, width: containerW })
  }, [topOffset, scaledHeight, containerW])

  return (
    <div id="dw-container" ref={containerRef} className="relative flex-1 overflow-hidden bg-neutral-900">
      <div
        id="dw-viewport"
        className="absolute origin-top-left overflow-hidden"
        style={{
          width: preset.width,
          height: preset.height,
          borderRadius: 4 / widthScale,
          outline: `${1 / widthScale}px solid rgba(255, 255, 255, 0.7)`,
          transform: widthScale < 1 ? `scale(${widthScale})` : undefined,
          top: topOffset,
          left: 0,
        }}
      >
        {containerSize && (
          <webview
            key={webviewKey}
            ref={webviewRef}
            src={initialSrc}
            partition={partition}
            className="absolute inset-0"
            // @ts-expect-error - webview attributes not in React types
            allowpopups="true"
          />
        )}
      </div>
      {isResizing && <div id="dw-resize-overlay" className="absolute inset-0 z-10" />}
    </div>
  )
}
