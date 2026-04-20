import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AcceptCtx, AutocompleteSource, FetchCtx, TriggerMatch } from './types'

export interface UseAutocompleteOptions {
  sources: AutocompleteSource[]
  draft: string
  setDraft: (v: string) => void
  cursorPos: number
  acceptCtx: Omit<AcceptCtx, 'draft' | 'setDraft' | 'tokenStart' | 'tokenEnd'>
  fetchCtx: FetchCtx
}

export interface ActiveMatch<Item = unknown> {
  source: AutocompleteSource<Item>
  match: TriggerMatch
  filtered: Item[]
}

export interface UseAutocompleteResult {
  show: boolean
  active: ActiveMatch | null
  selectedIndex: number
  setSelectedIndex: (i: number) => void
  accept: (index: number) => void
  close: () => void
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => boolean
  /**
   * Called by the composer before sending. Walks sources in order, returning the first
   * source's transform result. Use to expand slash-command templates on Enter.
   */
  transformSubmit: (draft: string) => import('./types').SubmitTransform | null
}

/**
 * Composes N autocomplete sources into a single menu.
 * First source whose `detect()` returns non-null wins (priority = registration order).
 */
export function useAutocomplete(opts: UseAutocompleteOptions): UseAutocompleteResult {
  const { sources, draft, setDraft, cursorPos, acceptCtx, fetchCtx } = opts
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [itemsBySource, setItemsBySource] = useState<Record<string, unknown[]>>({})
  const [dismissed, setDismissed] = useState<{ source: string; match: TriggerMatch } | null>(null)

  // Fetch items per source once (cwd-scoped). Sources are stable refs.
  const cwdRef = useRef(fetchCtx.cwd)
  cwdRef.current = fetchCtx.cwd
  useEffect(() => {
    let cancelled = false
    void Promise.all(
      sources.map(async (src) => {
        try {
          const items = await src.fetch({ cwd: cwdRef.current })
          return [src.id, items] as const
        } catch {
          return [src.id, [] as unknown[]] as const
        }
      })
    ).then((pairs) => {
      if (cancelled) return
      const next: Record<string, unknown[]> = {}
      for (const [id, items] of pairs) next[id] = items
      setItemsBySource(next)
    })
    return () => {
      cancelled = true
    }
  }, [sources, fetchCtx.cwd])

  // Detect which source is active. Iterate in registration order; first source whose
  // trigger matches AND yields a non-empty filtered list wins. Sources that trigger but
  // produce zero results fall through so later sources (e.g. built-ins) can display.
  const active = useMemo<ActiveMatch | null>(() => {
    for (const src of sources) {
      const match = src.detect(draft, cursorPos)
      if (!match) continue
      if (
        dismissed &&
        dismissed.source === src.id &&
        dismissed.match.tokenStart === match.tokenStart
      ) {
        continue
      }
      const items = itemsBySource[src.id] ?? []
      const filtered = src.filter(items, match.query)
      if (filtered.length === 0) continue
      return { source: src, match, filtered }
    }
    return null
  }, [sources, draft, cursorPos, itemsBySource, dismissed])

  const show = active !== null

  useEffect(() => {
    setSelectedIndex(0)
  }, [active?.source.id, active?.match.tokenStart, active?.match.query])

  // Clear dismissal on any draft/cursor change — Esc closes current state; next keystroke reopens.
  useEffect(() => {
    setDismissed(null)
  }, [draft, cursorPos])

  const accept = useCallback(
    (index: number) => {
      if (!active) return
      const item = active.filtered[index]
      if (!item) return
      void active.source.accept(item, {
        ...acceptCtx,
        draft,
        setDraft,
        tokenStart: active.match.tokenStart,
        tokenEnd: active.match.tokenEnd,
      })
    },
    [active, acceptCtx, draft, setDraft]
  )

  const close = useCallback(() => {
    if (active) setDismissed({ source: active.source.id, match: active.match })
  }, [active])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>): boolean => {
      if (!active) return false
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, active.filtered.length - 1))
        return true
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
        return true
      }
      if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        accept(selectedIndex)
        return true
      }
      if (e.key === 'Tab') {
        e.preventDefault()
        accept(selectedIndex)
        return true
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
        return true
      }
      return false
    },
    [active, selectedIndex, accept, close]
  )

  const transformSubmit = useCallback(
    (currentDraft: string) => {
      for (const src of sources) {
        if (!src.transformSubmit) continue
        const items = itemsBySource[src.id] ?? []
        const res = src.transformSubmit(currentDraft, items)
        if (res) return res
      }
      return null
    },
    [sources, itemsBySource]
  )

  return {
    show,
    active,
    selectedIndex,
    setSelectedIndex,
    accept,
    close,
    handleKeyDown,
    transformSubmit,
  }
}

/** Helper: splice-replace text in draft from [tokenStart, tokenEnd) with `replacement`. */
export function spliceReplace(
  draft: string,
  tokenStart: number,
  tokenEnd: number,
  replacement: string
): string {
  return draft.slice(0, tokenStart) + replacement + draft.slice(tokenEnd)
}
