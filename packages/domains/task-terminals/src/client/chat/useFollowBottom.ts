import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const THRESHOLD_PX = 70

/**
 * Callback ref that also exposes `.current` for imperative reads. Mirrors
 * the shape of React's `RefObject` so call sites can do both
 * `<div ref={scrollRef}>` and `scrollRef.current?.scrollTo(...)`.
 */
export interface CallbackRef<T> {
  (el: T | null): void
  current: T | null
}

export interface FollowBottomApi {
  scrollRef: CallbackRef<HTMLElement>
  contentRef: CallbackRef<HTMLElement>
  isAtBottom: boolean
  scrollToBottom: () => void
}

/**
 * Sticks scroll position to bottom of container when content grows.
 * Releases when user scrolls up past THRESHOLD_PX. Re-engages when user
 * scrolls back within THRESHOLD_PX.
 *
 * Programmatic scrolls are guarded so they don't read as user input.
 * Selection-in-progress and explicit user wheel-up always escape the lock.
 */
export function useFollowBottom(): FollowBottomApi {
  const stuckRef = useRef(true)
  const programmaticRef = useRef(false)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)

  const setStuck = useCallback((v: boolean) => {
    if (stuckRef.current === v) return
    stuckRef.current = v
    setIsAtBottom(v)
  }, [])

  const isUserSelectingInside = useCallback((root: HTMLElement) => {
    const sel = typeof window !== 'undefined' ? window.getSelection() : null
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return false
    const node = sel.getRangeAt(0).commonAncestorContainer
    return root.contains(node) || node.contains(root)
  }, [])

  const scrollRef = useMemo<CallbackRef<HTMLElement>>(() => {
    const handleScroll = () => {
      const el = scrollRef.current
      if (!el) return
      if (programmaticRef.current) return
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight
      setStuck(dist <= THRESHOLD_PX)
    }
    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY >= 0) return
      const el = scrollRef.current
      if (!el) return
      if (el.scrollHeight > el.clientHeight) setStuck(false)
    }
    const ref = ((el: HTMLElement | null) => {
      const prev = ref.current
      if (prev === el) return
      if (prev) {
        prev.removeEventListener('scroll', handleScroll)
        prev.removeEventListener('wheel', handleWheel)
      }
      ref.current = el
      if (el) {
        el.addEventListener('scroll', handleScroll, { passive: true })
        el.addEventListener('wheel', handleWheel, { passive: true })
      }
    }) as CallbackRef<HTMLElement>
    ref.current = null
    return ref
  }, [setStuck])

  const scrollNow = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    programmaticRef.current = true
    el.scrollTop = el.scrollHeight
    requestAnimationFrame(() => {
      programmaticRef.current = false
    })
  }, [scrollRef])

  const scrollToBottom = useCallback(() => {
    setStuck(true)
    scrollNow()
  }, [scrollNow, setStuck])

  const contentRef = useMemo<CallbackRef<HTMLElement>>(() => {
    const ref = ((el: HTMLElement | null) => {
      const prev = ref.current
      if (prev === el) return
      resizeObserverRef.current?.disconnect()
      resizeObserverRef.current = null
      ref.current = el
      if (!el) return
      let prevHeight = el.getBoundingClientRect().height
      const ro = new ResizeObserver((entries) => {
        const entry = entries[0]
        if (!entry) return
        const height = entry.contentRect.height
        const grew = height > prevHeight
        prevHeight = height
        if (!grew) return
        if (!stuckRef.current) return
        if (isUserSelectingInside(el)) return
        scrollNow()
      })
      ro.observe(el)
      resizeObserverRef.current = ro
      if (stuckRef.current) scrollNow()
    }) as CallbackRef<HTMLElement>
    ref.current = null
    return ref
  }, [isUserSelectingInside, scrollNow])

  useEffect(() => () => {
    resizeObserverRef.current?.disconnect()
    resizeObserverRef.current = null
  }, [])

  return { scrollRef, contentRef, isAtBottom, scrollToBottom }
}
