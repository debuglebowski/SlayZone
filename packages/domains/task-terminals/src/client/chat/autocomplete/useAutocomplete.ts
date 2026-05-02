import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AcceptCtx, AutocompleteSource, FetchCtx, TriggerMatch } from './types'
import { rankAcrossSources, type MergedEntry } from './ranking'

export interface UseAutocompleteOptions {
  sources: AutocompleteSource[]
  draft: string
  setDraft: (v: string) => void
  cursorPos: number
  acceptCtx: Omit<AcceptCtx, 'draft' | 'setDraft' | 'tokenStart' | 'tokenEnd'>
  fetchCtx: FetchCtx
}

export interface ActiveMatch {
  match: TriggerMatch
  entries: MergedEntry[]
  /** Lead source — used for menu data attribute and Esc-dismiss tracking. */
  leadSourceId: string
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

  // Detect active sources. All sources whose `detect()` returns the same token range as the
  // first match merge into one cross-source-ranked list (via fzf on the union). This avoids
  // a high-priority source's results shadowing later sources at the same trigger position.
  // Sources with a different token range OR no matches at all are skipped.
  const active = useMemo<ActiveMatch | null>(() => {
    let leadMatch: TriggerMatch | null = null
    let leadSourceId: string | null = null
    const groups: { source: AutocompleteSource; items: unknown[] }[] = []
    for (const src of sources) {
      const match = src.detect(draft, cursorPos)
      if (!match) continue
      if (!leadMatch) {
        if (
          dismissed &&
          dismissed.source === src.id &&
          dismissed.match.tokenStart === match.tokenStart
        ) {
          continue
        }
        leadMatch = match
        leadSourceId = src.id
      } else if (
        match.tokenStart !== leadMatch.tokenStart ||
        match.tokenEnd !== leadMatch.tokenEnd
      ) {
        continue
      }
      const items = itemsBySource[src.id] ?? []
      groups.push({ source: src, items })
    }
    if (!leadMatch || !leadSourceId || groups.length === 0) return null

    let entries: MergedEntry[]
    if (groups.some((g) => g.source.getName)) {
      entries = rankAcrossSources(groups, leadMatch.query)
    } else {
      entries = []
      for (const g of groups) {
        const filtered = g.source.filter(g.items, leadMatch.query)
        for (const item of filtered) entries.push({ item, source: g.source })
      }
    }
    if (entries.length === 0) return null
    return { match: leadMatch, entries, leadSourceId }
  }, [sources, draft, cursorPos, itemsBySource, dismissed])

  const show = active !== null

  useEffect(() => {
    setSelectedIndex(0)
  }, [active?.leadSourceId, active?.match.tokenStart, active?.match.query])

  // Clear dismissal on any draft/cursor change — Esc closes current state; next keystroke reopens.
  useEffect(() => {
    setDismissed(null)
  }, [draft, cursorPos])

  const accept = useCallback(
    (index: number) => {
      if (!active) return
      const entry = active.entries[index]
      if (!entry) return
      void entry.source.accept(entry.item, {
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
    if (active) setDismissed({ source: active.leadSourceId, match: active.match })
  }, [active])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>): boolean => {
      if (!active) return false
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, active.entries.length - 1))
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
