import { useEffect, useState, useCallback } from 'react'
import type { AgentTurnRange } from '../shared/types'

/**
 * Returns all turns for the given worktree path, oldest first. Re-fetches
 * when `agent-turns:changed` IPC fires for the same path.
 */
export function useAgentTurns(worktreePath: string | null | undefined): AgentTurnRange[] {
  const [turns, setTurns] = useState<AgentTurnRange[]>([])

  const reload = useCallback(async () => {
    if (!worktreePath) {
      setTurns([])
      return
    }
    const list = await window.api.agentTurns.list(worktreePath)
    setTurns(list)
  }, [worktreePath])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (!worktreePath) return
    const off = window.api.agentTurns.onChanged((changedPath) => {
      // Match either canonical or as-passed; main-side broadcast uses canonical,
      // renderer may pass either. Normalize via endsWith for the simplest match.
      if (changedPath === worktreePath || changedPath.endsWith(worktreePath) || worktreePath.endsWith(changedPath)) {
        void reload()
      }
    })
    return () => off()
  }, [worktreePath, reload])

  return turns
}
