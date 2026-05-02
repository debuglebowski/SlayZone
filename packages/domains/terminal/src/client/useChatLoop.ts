import { useCallback, useEffect, useRef, useState } from 'react'
import {
  makeLoopController,
  type LoopConfig,
  type LoopStatus,
  type LoopTransport,
} from '@slayzone/terminal/shared'
import type { TimelineItem } from './chat-timeline'

interface UseChatLoopOpts {
  /** Live timeline from useChatSession — read at iteration boundaries to evaluate criteria. */
  timeline: TimelineItem[]
  /** True while a turn is being streamed; transition true→false = iteration done. */
  inFlight: boolean
  /** True if the chat subprocess has exited; abort active loop. */
  sessionEnded: boolean
  /** Send a user message to the chat session. */
  sendMessage: (text: string) => void | Promise<void>
  /** Persistence callback — store config alongside the task. */
  onConfigChange: (config: LoopConfig | null) => void
}

/**
 * Chat-mode counterpart to `useLoopMode`. Drives the same iteration cycle (send →
 * wait-for-idle → check-criteria) but reads idle/exit signals from React state
 * instead of PTY events.
 *
 * Boundary marker = timeline length at iteration start. `readOutputSince` reads
 * assistant-text items appended after that index, concatenates them, and feeds
 * to `checkCriteria` (inside the controller).
 */
export function useChatLoop({ timeline, inFlight, sessionEnded, sendMessage, onConfigChange }: UseChatLoopOpts) {
  const [status, setStatus] = useState<LoopStatus>('idle')
  const [iteration, setIteration] = useState(0)

  const controllerRef = useRef<ReturnType<typeof makeLoopController<number>> | null>(null)
  const idleCbRef = useRef<(() => void) | null>(null)
  const exitCbRef = useRef<(() => void) | null>(null)

  // Refs hold the latest timeline + transition source — read at evaluation time
  // by the controller's transport callbacks (which are otherwise stale closures).
  const timelineRef = useRef(timeline)
  timelineRef.current = timeline
  const onConfigChangeRef = useRef(onConfigChange)
  onConfigChangeRef.current = onConfigChange
  const sendRef = useRef(sendMessage)
  sendRef.current = sendMessage

  // Detect inFlight true→false transitions and fire the idle callback.
  const prevInFlightRef = useRef(inFlight)
  useEffect(() => {
    if (prevInFlightRef.current && !inFlight) {
      idleCbRef.current?.()
    }
    prevInFlightRef.current = inFlight
  }, [inFlight])

  // Fire exit callback when session terminates.
  useEffect(() => {
    if (sessionEnded) exitCbRef.current?.()
  }, [sessionEnded])

  useEffect(() => {
    const transport: LoopTransport<number> = {
      markBoundary: () => timelineRef.current.length,
      send: (prompt) => { void sendRef.current(prompt) },
      readOutputSince: async (boundaryIdx) => {
        const after = timelineRef.current.slice(boundaryIdx)
        const text = after
          .filter((it): it is Extract<TimelineItem, { kind: 'text' }> => it.kind === 'text' && it.role === 'assistant')
          .map((it) => it.text)
          .join('\n')
        return text
      },
      subscribeIdle: (cb) => { idleCbRef.current = cb; return () => { if (idleCbRef.current === cb) idleCbRef.current = null } },
      subscribeExit: (cb) => { exitCbRef.current = cb; return () => { if (exitCbRef.current === cb) exitCbRef.current = null } },
    }
    const controller = makeLoopController<number>(transport, {
      onStatus: setStatus,
      onIteration: setIteration,
    })
    controllerRef.current = controller
    return () => { controller.dispose(); controllerRef.current = null }
  }, [])

  const startLoop = useCallback((config: LoopConfig) => {
    onConfigChangeRef.current(config)
    controllerRef.current?.start(config)
  }, [])
  const pauseLoop = useCallback(() => controllerRef.current?.pause(), [])
  const resumeLoop = useCallback(() => controllerRef.current?.resume(), [])
  const stopLoop = useCallback(() => controllerRef.current?.stop(), [])

  return { status, iteration, startLoop, pauseLoop, resumeLoop, stopLoop }
}
