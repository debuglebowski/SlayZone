import { useMemo } from 'react'
import { getNextTask } from '@/lib/prioritization'
import type { Task } from '@omgslayzone/task/shared'

export function useWhatNext(tasks: Task[]): Task | null {
  return useMemo(() => getNextTask(tasks), [tasks])
}
