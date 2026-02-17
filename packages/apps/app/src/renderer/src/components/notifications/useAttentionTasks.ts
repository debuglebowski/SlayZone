import { useState, useEffect, useCallback } from 'react'
import type { PtyInfo } from '@slayzone/terminal/shared'
import type { Task } from '@slayzone/task/shared'

export interface AttentionTask {
  task: Task
  sessionId: string
  lastOutputTime: number
}

interface UseAttentionTasksResult {
  attentionTasks: AttentionTask[]
  count: number
  refresh: () => Promise<void>
}

export function useAttentionTasks(
  tasks: Task[],
  filterProjectId: string | null
): UseAttentionTasksResult {
  const [ptys, setPtys] = useState<PtyInfo[]>([])

  const refresh = useCallback(async () => {
    const list = await window.api.pty.list()
    setPtys(list.filter((p) => p.state === 'attention'))
  }, [])

  // Initial load
  useEffect(() => {
    refresh()
  }, [refresh])

  // Refresh on attention/state-change events
  useEffect(() => {
    const unsubAttention = window.api.pty.onAttention(() => refresh())
    const unsubStateChange = window.api.pty.onStateChange(() => refresh())
    return () => {
      unsubAttention()
      unsubStateChange()
    }
  }, [refresh])

  // Build attention tasks list
  const attentionTasks: AttentionTask[] = ptys
    .map((pty) => {
      const taskId = pty.sessionId.split(':')[0]
      const task = tasks.find((t) => t.id === taskId)
      if (!task) return null
      if (filterProjectId && task.project_id !== filterProjectId) return null
      return {
        task,
        sessionId: pty.sessionId,
        lastOutputTime: pty.lastOutputTime
      }
    })
    .filter((item): item is AttentionTask => item !== null)

  return {
    attentionTasks,
    count: attentionTasks.length,
    refresh
  }
}
