import { useState, useRef, useEffect, useCallback } from 'react'
import { computeScale, MOBILE_UA, IPAD_UA } from '@slayzone/task-browser/client'
import type { WebPanelEnvironment, WebPanelResolution, WebPanelResolutionDefaults } from '../shared/types'
import { DEFAULT_WEB_PANEL_RESOLUTION_DEFAULTS } from '../shared/types'

/** Hardcoded emulation params per environment (user only controls W×H) */
const ENV_PARAMS: Record<WebPanelEnvironment, {
  deviceScaleFactor: number
  screenPosition: 'mobile' | 'desktop'
  userAgent?: string
}> = {
  desktop: { deviceScaleFactor: 1, screenPosition: 'desktop' },
  tablet:  { deviceScaleFactor: 2, screenPosition: 'mobile', userAgent: IPAD_UA },
  mobile:  { deviceScaleFactor: 2, screenPosition: 'mobile', userAgent: MOBILE_UA },
}

interface WebviewElement extends HTMLElement {
  getWebContentsId(): number
  reload(): void
}

interface UseWebPanelEmulationOpts {
  webviewRef: React.RefObject<WebviewElement | null>
  webviewReady: boolean
  resolution: WebPanelResolution | null
  defaults: WebPanelResolutionDefaults | undefined
  containerSize: { width: number; height: number } | null
  onResolutionChange: (resolution: WebPanelResolution | null) => void
}

export interface UseWebPanelEmulationResult {
  environment: WebPanelEnvironment | null
  setEnvironment: (env: WebPanelEnvironment | null) => void
  resetToDefaults: () => void
  effectiveSize: { width: number; height: number } | null
  scale: number
  dragSize: { width: number; height: number } | null
  handleResizeStart: (e: React.MouseEvent, axis: 'x' | 'y' | 'xy') => void
  isResizeDragging: boolean
}

function resolveSize(
  resolution: WebPanelResolution | null,
  defaults: WebPanelResolutionDefaults
): { width: number; height: number } | null {
  if (!resolution) return null
  const def = defaults[resolution.environment]
  return {
    width: resolution.customWidth ?? def.width,
    height: resolution.customHeight ?? def.height,
  }
}

export function useWebPanelEmulation({
  webviewRef,
  webviewReady,
  resolution,
  defaults,
  containerSize,
  onResolutionChange,
}: UseWebPanelEmulationOpts): UseWebPanelEmulationResult {
  const resolvedDefaults = defaults ?? DEFAULT_WEB_PANEL_RESOLUTION_DEFAULTS
  const environment = resolution?.environment ?? null
  const effectiveSize = resolveSize(resolution, resolvedDefaults)

  // --- Device emulation API ---
  const prevEmulationRef = useRef<{ env: string; w: number; h: number; ua?: string } | null>(null)
  const mountedRef = useRef(false)

  useEffect(() => {
    const wv = webviewRef.current
    if (!wv || !webviewReady) return

    const cur = effectiveSize && environment ? {
      env: environment,
      w: effectiveSize.width,
      h: effectiveSize.height,
      ua: ENV_PARAMS[environment].userAgent,
    } : null
    const prev = prevEmulationRef.current

    if (!mountedRef.current) {
      mountedRef.current = true
      if (!cur) { prevEmulationRef.current = null; return }
    }

    if (cur && prev && cur.env === prev.env && cur.w === prev.w && cur.h === prev.h && cur.ua === prev.ua) return

    const prevUa = prev?.ua
    prevEmulationRef.current = cur

    const wcId = wv.getWebContentsId()
    if (cur && environment) {
      const params = ENV_PARAMS[environment]
      window.api.webview?.enableDeviceEmulation(wcId, {
        screenSize: { width: cur.w, height: cur.h },
        viewSize: { width: cur.w, height: cur.h },
        deviceScaleFactor: params.deviceScaleFactor,
        screenPosition: params.screenPosition,
        userAgent: params.userAgent,
      }).then(() => {
        if (cur.ua !== prevUa) wv.reload()
      })
    } else {
      window.api.webview?.disableDeviceEmulation(wcId).then(() => {
        if (prevUa) wv.reload()
      })
    }
  }, [environment, effectiveSize?.width, effectiveSize?.height, webviewReady, webviewRef])

  // --- Environment toggle ---
  const setEnvironment = useCallback((env: WebPanelEnvironment | null) => {
    if (!env) {
      onResolutionChange(null)
    } else {
      onResolutionChange({ environment: env })
    }
  }, [onResolutionChange])

  const resetToDefaults = useCallback(() => {
    if (!environment) return
    onResolutionChange({ environment })
  }, [environment, onResolutionChange])

  // --- Scale ---
  const [dragSize, setDragSize] = useState<{ width: number; height: number } | null>(null)
  const [dragScale, setDragScale] = useState<number | null>(null)
  const dragRef = useRef<{ startX: number; startY: number; startW: number; startH: number; axis: 'x' | 'y' | 'xy'; latestW: number; latestH: number } | null>(null)
  const dragCleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    return () => { dragCleanupRef.current?.() }
  }, [])

  const scale = dragScale ?? computeScale(containerSize, effectiveSize)

  // --- Resize drag ---
  const handleResizeStart = useCallback((e: React.MouseEvent, axis: 'x' | 'y' | 'xy') => {
    if (!effectiveSize || !environment) return
    e.preventDefault()
    const startW = effectiveSize.width
    const startH = effectiveSize.height
    const frozen = computeScale(containerSize, { width: startW, height: startH })
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
      if (d && environment) {
        onResolutionChange({
          environment,
          customWidth: d.latestW,
          customHeight: d.latestH,
        })
      }
      setDragSize(null)
      setDragScale(null)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    dragCleanupRef.current = cleanup
  }, [effectiveSize, environment, containerSize, onResolutionChange])

  return {
    environment,
    setEnvironment,
    resetToDefaults,
    effectiveSize,
    scale,
    dragSize,
    handleResizeStart,
    isResizeDragging: dragSize !== null,
  }
}
