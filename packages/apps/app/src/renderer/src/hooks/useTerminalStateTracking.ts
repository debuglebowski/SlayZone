import { useState, useEffect } from 'react'
import type { TerminalState } from '@slayzone/terminal/shared'

type PtyContext = {
  getState: (sessionId: string) => TerminalState
  subscribeState: (sessionId: string, cb: (state: TerminalState) => void) => () => void
}

export function useTerminalStateTracking(
  openTaskIds: string[],
  ptyContext: PtyContext
): Map<string, TerminalState> {
  const [terminalStates, setTerminalStates] = useState<Map<string, TerminalState>>(new Map())

  useEffect(() => {
    const unsubscribes: (() => void)[] = []

    for (const taskId of openTaskIds) {
      const mainSessionId = `${taskId}:${taskId}`

      const currentState = ptyContext.getState(mainSessionId)
      setTerminalStates((prev) => {
        const next = new Map(prev)
        next.set(taskId, currentState)
        return next
      })

      const unsub = ptyContext.subscribeState(mainSessionId, (newState) => {
        setTerminalStates((prev) => {
          const next = new Map(prev)
          next.set(taskId, newState)
          return next
        })
      })
      unsubscribes.push(unsub)
    }

    setTerminalStates((prev) => {
      const openSet = new Set(openTaskIds)
      const next = new Map(prev)
      for (const key of next.keys()) {
        if (!openSet.has(key)) next.delete(key)
      }
      return next
    })

    return () => unsubscribes.forEach((fn) => fn())
  }, [openTaskIds, ptyContext])

  return terminalStates
}
