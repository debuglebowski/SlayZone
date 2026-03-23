import { useCallback, useRef, useEffect } from 'react'

interface UseBrowserViewBoundsOpts {
  visible: boolean
  hidden?: boolean
  isResizing?: boolean
}

export function useBrowserViewBounds(
  viewId: string | null,
  opts: UseBrowserViewBoundsOpts
): { placeholderRef: (el: HTMLDivElement | null) => void } {
  const { visible, hidden, isResizing } = opts
  const effectivelyVisible = visible && !hidden && !isResizing

  const elementRef = useRef<HTMLDivElement | null>(null)
  const rafRef = useRef<number>(0)
  const lastBoundsRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null)
  const viewIdRef = useRef(viewId)
  const effectivelyVisibleRef = useRef(effectivelyVisible)

  viewIdRef.current = viewId
  effectivelyVisibleRef.current = effectivelyVisible

  // Sync visibility changes
  useEffect(() => {
    if (!viewId) return
    void window.api.browser.setVisible(viewId, effectivelyVisible)
  }, [viewId, effectivelyVisible])

  // Track whether we've hidden this view due to a dialog overlay
  const hiddenByOverlayRef = useRef(false)

  // rAF bounds tracking loop
  const startLoop = useCallback(() => {
    const tick = () => {
      const el = elementRef.current
      const vid = viewIdRef.current
      if (!el || !vid || !effectivelyVisibleRef.current) {
        rafRef.current = 0
        return
      }

      // Check if a dialog overlay or popover is present — hide ALL views
      const hasOverlay = !!document.querySelector('[data-slot="dialog-overlay"], [data-slot="alert-dialog-overlay"], [data-slot="popover-content"]')
      if (hasOverlay && !hiddenByOverlayRef.current) {
        hiddenByOverlayRef.current = true
        void window.api.browser.hideAll()
      } else if (!hasOverlay && hiddenByOverlayRef.current) {
        hiddenByOverlayRef.current = false
        void window.api.browser.showAll()
      }

      // Only sync bounds when not hidden by overlay
      if (!hiddenByOverlayRef.current) {
        const rect = el.getBoundingClientRect()
        const x = Math.round(rect.left)
        const y = Math.round(rect.top)
        const width = Math.round(rect.width)
        const height = Math.round(rect.height)

        const last = lastBoundsRef.current
        if (!last || last.x !== x || last.y !== y || last.width !== width || last.height !== height) {
          lastBoundsRef.current = { x, y, width, height }
          if (width > 0 && height > 0) {
            void window.api.browser.setBounds(vid, { x, y, width, height })
          }
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(tick)
    }
  }, [])

  const stopLoop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
  }, [])

  // Start/stop loop when visibility or viewId changes
  useEffect(() => {
    if (viewId && effectivelyVisible && elementRef.current) {
      startLoop()
    } else {
      stopLoop()
    }
    return stopLoop
  }, [viewId, effectivelyVisible, startLoop, stopLoop])

  // Focus bridge: mousedown on placeholder focuses the view
  const handleMouseDown = useCallback(() => {
    const vid = viewIdRef.current
    if (vid) {
      void window.api.browser.focus(vid)
    }
  }, [])

  // Callback ref — handles conditional mounting
  const placeholderRef = useCallback((el: HTMLDivElement | null) => {
    const prev = elementRef.current
    elementRef.current = el

    if (el && !prev) {
      // Attached — start loop if conditions met
      el.addEventListener('mousedown', handleMouseDown)
      if (viewIdRef.current && effectivelyVisibleRef.current) {
        lastBoundsRef.current = null // force initial sync
        startLoop()
      }
    } else if (!el && prev) {
      // Detached — stop loop
      prev.removeEventListener('mousedown', handleMouseDown)
      stopLoop()
      lastBoundsRef.current = null
    }
  }, [handleMouseDown, startLoop, stopLoop])

  return { placeholderRef }
}
