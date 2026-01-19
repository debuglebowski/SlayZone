import { useState, useEffect, useCallback } from 'react'

/**
 * Returns Set of taskIds with active (non-idle) PTY sessions
 */
export function usePtyStatus(): Set<string> {
  const [activeTaskIds, setActiveTaskIds] = useState<Set<string>>(new Set())

  const refresh = useCallback(async () => {
    const list = await window.api.pty.list()
    const active = new Set(list.filter((p) => !p.isIdle).map((p) => p.taskId))
    setActiveTaskIds(active)
  }, [])

  // Initial load
  useEffect(() => {
    refresh()
  }, [refresh])

  // Refresh on idle events
  useEffect(() => {
    const unsub = window.api.pty.onIdle(() => {
      refresh()
    })
    return unsub
  }, [refresh])

  // Poll every 5s as backup (catches active transitions)
  useEffect(() => {
    const interval = setInterval(refresh, 5000)
    return () => clearInterval(interval)
  }, [refresh])

  return activeTaskIds
}
