/**
 * Task status styling - shared across all components
 */

export type TaskStatusStyle = {
  bg: string
  text: string
  label: string
}

const TASK_STATUS_STYLES: Record<string, TaskStatusStyle> = {
  inbox: { bg: 'bg-gray-200', text: 'text-gray-700', label: 'Inbox' },
  backlog: { bg: 'bg-slate-200', text: 'text-slate-700', label: 'Backlog' },
  todo: { bg: 'bg-blue-200', text: 'text-blue-700', label: 'Todo' },
  in_progress: { bg: 'bg-yellow-200', text: 'text-yellow-700', label: 'In Progress' },
  review: { bg: 'bg-purple-200', text: 'text-purple-700', label: 'Review' },
  done: { bg: 'bg-green-200', text: 'text-green-700', label: 'Done' }
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
