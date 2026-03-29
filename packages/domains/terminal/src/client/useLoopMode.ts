import { useCallback, useEffect, useRef, useState } from 'react'
import type { TerminalState, LoopConfig, CriteriaType } from '@slayzone/terminal/shared'
import { usePty } from './PtyContext'

export type { LoopConfig, CriteriaType }

export type LoopStatus = 'idle' | 'sending' | 'waiting' | 'checking' | 'paused' | 'passed' | 'stopped' | 'error' | 'max-reached'

export interface LoopState {
  active: boolean
  iteration: number
  status: LoopStatus
  config: LoopConfig
}

const DEFAULT_CONFIG: LoopConfig = {
  prompt: '',
  criteriaType: 'contains',
  criteriaPattern: '',
  maxIterations: 50
}

export function stripAnsi(str: string): string {
  return str
    .replace(/\x1b\[[0-9;]*[A-Za-z]/g, '')
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
    .replace(/[\x00-\x09\x0b-\x0c\x0e-\x1f]/g, '')
}

export function checkCriteria(output: string, type: CriteriaType, pattern: string): boolean {
  const stripped = stripAnsi(output)
  switch (type) {
    case 'contains':
      return stripped.includes(pattern)
    case 'not-contains':
      return !stripped.includes(pattern)
    case 'regex':
      try {
        return new RegExp(pattern).test(stripped)
      } catch {
        return false
      }
  }
}

interface UseLoopModeOptions {
  sessionId: string
  config: LoopConfig | null
  onConfigChange: (config: LoopConfig | null) => void
}

export function useLoopMode({ sessionId, config, onConfigChange }: UseLoopModeOptions) {
  const { subscribeState, subscribeExit, getLastSeq } = usePty()

  const currentConfig = config ?? DEFAULT_CONFIG
  const [state, setState] = useState<LoopState>({
    active: false,
    iteration: 0,
    status: 'idle',
    config: currentConfig
  })

  // Keep state.config in sync with prop
  useEffect(() => {
    setState(s => ({ ...s, config: config ?? DEFAULT_CONFIG }))
    configRef.current = config ?? DEFAULT_CONFIG
  }, [config])

  // Refs for the loop engine (avoids stale closures)
  const activeRef = useRef(false)
  const configRef = useRef(currentConfig)
  const iterationRef = useRef(0)
  const seqRef = useRef(-1)
  const sessionIdRef = useRef(sessionId)
  sessionIdRef.current = sessionId
  const onConfigChangeRef = useRef(onConfigChange)
  onConfigChangeRef.current = onConfigChange

  // Run one iteration: send prompt, wait for attention, check output
  const runIteration = useCallback(() => {
    if (!activeRef.current) return

    const sid = sessionIdRef.current
    if (!sid) return

    iterationRef.current++
    const iteration = iterationRef.current

    setState(s => ({ ...s, iteration, status: 'sending' }))

    // Record seq before sending
    seqRef.current = getLastSeq(sid)

    // Send prompt
    window.api.pty.write(sid, configRef.current.prompt + '\r').then((ok) => {
      if (!ok || !activeRef.current) return
      setState(s => ({ ...s, status: 'waiting' }))
    })
  }, [getLastSeq])

  // Handle state transitions from PTY
  const handleStateChange = useCallback((newState: TerminalState, _oldState: TerminalState) => {
    if (!activeRef.current) return

    // Only proceed when terminal reaches attention (AI finished responding)
    if (newState !== 'attention') return

    const sid = sessionIdRef.current
    setState(s => ({ ...s, status: 'checking' }))

    // Read output since prompt was sent
    window.api.pty.getBufferSince(sid, seqRef.current).then((result) => {
      if (!activeRef.current) return
      if (!result) {
        setState(s => ({ ...s, status: 'error', active: false }))
        activeRef.current = false
        return
      }

      const output = result.chunks.map(c => c.data).join('')
      const { criteriaType, criteriaPattern, maxIterations } = configRef.current
      const passed = checkCriteria(output, criteriaType, criteriaPattern)

      if (passed) {
        setState(s => ({ ...s, status: 'passed', active: false }))
        activeRef.current = false
        return
      }

      if (iterationRef.current >= maxIterations) {
        setState(s => ({ ...s, status: 'max-reached', active: false }))
        activeRef.current = false
        return
      }

      // Schedule next iteration with a small delay to let the terminal settle
      setTimeout(() => runIteration(), 500)
    })
  }, [runIteration])

  // Subscribe to PTY state changes and exit events
  useEffect(() => {
    if (!sessionId) return
    const unsubState = subscribeState(sessionId, handleStateChange)
    const unsubExit = subscribeExit(sessionId, () => {
      if (activeRef.current) {
        activeRef.current = false
        setState(s => ({ ...s, status: 'stopped', active: false }))
      }
    })
    return () => { unsubState(); unsubExit() }
  }, [sessionId, subscribeState, subscribeExit, handleStateChange])

  const startLoop = useCallback((loopConfig: LoopConfig) => {
    configRef.current = loopConfig
    onConfigChangeRef.current(loopConfig)
    iterationRef.current = 0
    activeRef.current = true
    setState({ active: true, iteration: 0, status: 'idle', config: loopConfig })
    runIteration()
  }, [runIteration])

  const pauseLoop = useCallback(() => {
    activeRef.current = false
    setState(s => ({ ...s, status: 'paused', active: false }))
  }, [])

  const resumeLoop = useCallback(() => {
    activeRef.current = true
    setState(s => ({ ...s, status: 'idle', active: true }))
    runIteration()
  }, [runIteration])

  const stopLoop = useCallback(() => {
    activeRef.current = false
    setState(s => ({ ...s, status: 'stopped', active: false, iteration: 0 }))
  }, [])

  const updateConfig = useCallback((partial: Partial<LoopConfig>) => {
    const updated = { ...configRef.current, ...partial }
    configRef.current = updated
    onConfigChangeRef.current(updated)
    setState(s => ({ ...s, config: updated }))
  }, [])

  return { loopState: state, startLoop, pauseLoop, resumeLoop, stopLoop, updateConfig }
}
