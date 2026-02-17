import { useState, useEffect, useCallback } from 'react'

/**
 * Returns Set of sessionIds with active (non-attention) PTY sessions
 */
export function usePtyStatus(): Set<string> {
  const [activeSessionIds, setActiveSessionIds] = useState<Set<string>>(new Set())

  const refresh = useCallback(async () => {
    const list = await window.api.pty.list()
    const active = new Set(list.filter((p) => p.state !== 'attention' && p.state !== 'dead').map((p) => p.sessionId))
    setActiveSessionIds(active)
  }, [])

  // Initial load
  useEffect(() => {
    refresh()
  }, [refresh])

  // Refresh on attention events
  useEffect(() => {
    const unsub = window.api.pty.onAttention(() => {
      refresh()
    })
    return unsub
  }, [refresh])

  // Poll every 5s as backup (catches active transitions)
  useEffect(() => {
    const interval = setInterval(refresh, 5000)
    return () => clearInterval(interval)
  }, [refresh])

  return activeSessionIds
}
