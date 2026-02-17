/**
 * Task status styling - shared across all components
 */
import type { LucideIcon } from 'lucide-react'
import { Inbox, CircleDashed, Circle, CircleDot, Eye, CircleCheck } from 'lucide-react'

export type TaskStatusStyle = {
  bg: string
  text: string
  label: string
  icon: LucideIcon
  iconClass: string
}

const TASK_STATUS_STYLES: Record<string, TaskStatusStyle> = {
  inbox: { bg: 'bg-gray-200', text: 'text-gray-700', label: 'Inbox', icon: Inbox, iconClass: 'text-gray-500' },
  backlog: { bg: 'bg-slate-200', text: 'text-slate-700', label: 'Backlog', icon: CircleDashed, iconClass: 'text-slate-400' },
  todo: { bg: 'bg-blue-200', text: 'text-blue-700', label: 'Todo', icon: Circle, iconClass: 'text-blue-500' },
  in_progress: { bg: 'bg-yellow-200', text: 'text-yellow-700', label: 'In Progress', icon: CircleDot, iconClass: 'text-yellow-500' },
  review: { bg: 'bg-purple-200', text: 'text-purple-700', label: 'Review', icon: Eye, iconClass: 'text-purple-500' },
  done: { bg: 'bg-green-200', text: 'text-green-700', label: 'Done', icon: CircleCheck, iconClass: 'text-green-500' }
}

export function getTaskStatusStyle(status: string | undefined): TaskStatusStyle | null {
  if (!status) return null
  return TASK_STATUS_STYLES[status] ?? null
}

export const TASK_STATUS_ORDER = [
  'inbox',
  'backlog',
  'todo',
  'in_progress',
  'review',
  'done'
] as const

export const taskStatusOptions = TASK_STATUS_ORDER.map((status) => ({
  value: status,
  label: TASK_STATUS_STYLES[status].label
}))
