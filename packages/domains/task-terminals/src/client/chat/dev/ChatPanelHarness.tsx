/**
 * Phase 0: dev-only harness for replaying captured Claude Code stream-json
 * fixtures through the live reducer + renderers. Exists to make rendering bugs
 * deterministic — drop a fixture in, hit play, watch the panel paint.
 *
 * Not wired into any production route. Mount manually from a dev page when
 * eyeballing a regression. The headless equivalent for CI lives in
 * `__perf__/baseline.test.ts` and exercises the same reducer path.
 *
 * Usage:
 *   <ChatPanelHarness fixture="multi-tool" rate="real-time" />
 *   <ChatPanelHarness events={loadedEvents} rate={10} />
 */
import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { reducer, initialState, type ChatTimelineState, type Action } from '@slayzone/terminal/client'
import type { AgentEvent } from '@slayzone/terminal/shared'
import { ChatViewContext } from '../ChatViewContext'
import { renderTimelineItem } from '../renderers'

export type ReplayRate = 'real-time' | 'instant' | number

export interface ChatPanelHarnessProps {
  /** Pre-loaded normalized events. If absent, `fixture` must be provided. */
  events?: AgentEvent[]
  /** Fixture name (without .ndjson). Resolved server-side; pass `events` from a loader instead in pure-renderer contexts. */
  fixture?: string
  /** real-time = use 16ms ticks, instant = flush all, number = events per second. */
  rate?: ReplayRate
  /** Auto-start when mounted. Default true. */
  autoplay?: boolean
}

interface PlaybackStats {
  applied: number
  total: number
  elapsedMs: number
  lastDispatchMs: number
}

export function ChatPanelHarness({
  events,
  fixture,
  rate = 'real-time',
  autoplay = true,
}: ChatPanelHarnessProps) {
  const [state, dispatch] = useReducer(
    (s: ChatTimelineState, a: Action) => reducer(s, a),
    undefined,
    initialState,
  )
  const [playing, setPlaying] = useState(autoplay)
  const [stats, setStats] = useState<PlaybackStats>({ applied: 0, total: 0, elapsedMs: 0, lastDispatchMs: 0 })
  const cursorRef = useRef(0)
  const startedAtRef = useRef<number | null>(null)
  const eventsRef = useRef<AgentEvent[]>([])

  useEffect(() => {
    eventsRef.current = events ?? []
    cursorRef.current = 0
    startedAtRef.current = null
    setStats({ applied: 0, total: events?.length ?? 0, elapsedMs: 0, lastDispatchMs: 0 })
    dispatch({ type: 'reset' })
  }, [events])

  useEffect(() => {
    if (!playing || eventsRef.current.length === 0) return
    if (cursorRef.current >= eventsRef.current.length) return

    if (rate === 'instant') {
      const t0 = performance.now()
      for (const event of eventsRef.current) {
        dispatch({ type: 'event', event })
      }
      const elapsed = performance.now() - t0
      cursorRef.current = eventsRef.current.length
      setStats({
        applied: eventsRef.current.length,
        total: eventsRef.current.length,
        elapsedMs: elapsed,
        lastDispatchMs: elapsed,
      })
      setPlaying(false)
      return
    }

    const tickMs = rate === 'real-time' ? 16 : Math.max(1, 1000 / rate)
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const tick = (): void => {
      if (cancelled) return
      const i = cursorRef.current
      if (i >= eventsRef.current.length) {
        setPlaying(false)
        return
      }
      const t0 = performance.now()
      dispatch({ type: 'event', event: eventsRef.current[i] })
      const dispatched = performance.now() - t0
      cursorRef.current = i + 1
      if (startedAtRef.current == null) startedAtRef.current = performance.now()
      setStats({
        applied: i + 1,
        total: eventsRef.current.length,
        elapsedMs: performance.now() - (startedAtRef.current ?? performance.now()),
        lastDispatchMs: dispatched,
      })
      timer = setTimeout(tick, tickMs)
    }

    tick()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [playing, rate])

  const chatView = useMemo(
    () => ({
      collapseSignal: 0,
      finalOnly: false,
      fileEditsOpenByDefault: true,
      search: { query: '', caseSensitive: false },
      timeline: state.timeline,
      childIndex: state.childIndex,
    }),
    [state.timeline, state.childIndex],
  )

  return (
    <ChatViewContext.Provider value={chatView}>
      <div className="flex h-full flex-col bg-background">
        <header className="flex shrink-0 items-center gap-3 border-b border-border bg-surface-1 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-mono">{fixture ?? 'events'}</span>
          <span>·</span>
          <span>
            {stats.applied}/{stats.total} events
          </span>
          <span>·</span>
          <span>{stats.elapsedMs.toFixed(0)}ms total</span>
          <span>·</span>
          <span>last dispatch {stats.lastDispatchMs.toFixed(2)}ms</span>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              className="rounded border border-border bg-surface-2 px-2 py-0.5 hover:bg-accent"
              onClick={() => setPlaying((p) => !p)}
            >
              {playing ? 'Pause' : 'Play'}
            </button>
            <button
              type="button"
              className="rounded border border-border bg-surface-2 px-2 py-0.5 hover:bg-accent"
              onClick={() => {
                cursorRef.current = 0
                startedAtRef.current = null
                setStats({ applied: 0, total: eventsRef.current.length, elapsedMs: 0, lastDispatchMs: 0 })
                dispatch({ type: 'reset' })
              }}
            >
              Reset
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-auto">
          {state.timeline.map((item, i) =>
            item.parentToolUseId == null ? renderTimelineItem(item, i) : null,
          )}
        </div>
      </div>
    </ChatViewContext.Provider>
  )
}
