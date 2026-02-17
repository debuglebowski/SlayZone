import type { Task, TaskStatus } from '@slayzone/task/shared'
import { TASK_STATUS_ORDER, getTaskStatusStyle } from '@slayzone/ui'
import type { FilterState, DueDateRange, SortKey } from './FilterState'

export type GroupKey = 'status' | 'priority' | 'due_date'

export interface Column {
  id: string
  title: string
  tasks: Task[]
}

export const STATUS_ORDER = TASK_STATUS_ORDER as unknown as TaskStatus[]

export const STATUS_LABELS: Record<TaskStatus, string> = Object.fromEntries(
  TASK_STATUS_ORDER.map((status) => [status, getTaskStatusStyle(status)!.label])
) as Record<TaskStatus, string>

export const PRIORITY_LABELS: Record<number, string> = {
  1: 'Urgent',
  2: 'High',
  3: 'Medium',
  4: 'Low',
  5: 'Someday'
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

export function addDaysISO(date: string, days: number): string {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function sortTasks(tasks: Task[], sortBy: SortKey): Task[] {
  return [...tasks].sort((a, b) => {
    switch (sortBy) {
      case 'priority':
        return a.priority !== b.priority ? a.priority - b.priority : a.order - b.order
      case 'due_date': {
        if (!a.due_date && !b.due_date) return a.order - b.order
        if (!a.due_date) return 1
        if (!b.due_date) return -1
        return a.due_date !== b.due_date ? a.due_date.localeCompare(b.due_date) : a.order - b.order
      }
      case 'title':
        return a.title.localeCompare(b.title)
      case 'created':
        return b.created_at.localeCompare(a.created_at) // newest first
      case 'manual':
      default:
        return a.order - b.order
    }
  })
}

function groupByStatus(tasks: Task[], sortBy: SortKey): Column[] {
  const sorted = sortTasks(tasks, sortBy)
  return STATUS_ORDER.map((status) => ({
    id: status,
    title: STATUS_LABELS[status],
    tasks: sorted.filter((t) => t.status === status)
  }))
}

function groupByPriority(tasks: Task[], sortBy: SortKey): Column[] {
  const sorted = sortTasks(tasks, sortBy)
  return [1, 2, 3, 4, 5].map((priority) => ({
    id: `p${priority}`,
    title: PRIORITY_LABELS[priority],
    tasks: sorted.filter((t) => t.priority === priority)
  }))
}

function groupByDueDate(tasks: Task[], sortBy: SortKey): Column[] {
  const sorted = sortTasks(tasks, sortBy)
  const today = todayISO()
  const weekEnd = addDaysISO(today, 7)

  const overdue: Task[] = []
  const todayTasks: Task[] = []
  const thisWeek: Task[] = []
  const later: Task[] = []
  const noDate: Task[] = []

  for (const task of sorted) {
    if (!task.due_date) {
      noDate.push(task)
    } else if (task.due_date < today) {
      overdue.push(task)
    } else if (task.due_date === today) {
      todayTasks.push(task)
    } else if (task.due_date <= weekEnd) {
      thisWeek.push(task)
    } else {
      later.push(task)
    }
  }

  return [
    { id: 'overdue', title: 'Overdue', tasks: overdue },
    { id: 'today', title: 'Today', tasks: todayTasks },
    { id: 'this_week', title: 'This Week', tasks: thisWeek },
    { id: 'later', title: 'Later', tasks: later },
    { id: 'no_date', title: 'No Date', tasks: noDate }
  ]
}

export function groupTasksBy(tasks: Task[], groupBy: GroupKey, sortBy: SortKey = 'manual'): Column[] {
  switch (groupBy) {
    case 'status':
      return groupByStatus(tasks, sortBy)
    case 'priority':
      return groupByPriority(tasks, sortBy)
    case 'due_date':
      return groupByDueDate(tasks, sortBy)
  }
}

function matchesDueDateRange(dueDate: string | null, range: DueDateRange): boolean {
  if (range === 'all') return true

  const today = todayISO()
  const weekEnd = addDaysISO(today, 7)

  if (!dueDate) {
    // Tasks without due date don't match specific date ranges
    return false
  }

  switch (range) {
    case 'overdue':
      return dueDate < today
    case 'today':
      return dueDate === today
    case 'week':
      return dueDate > today && dueDate <= weekEnd
    case 'later':
      return dueDate > weekEnd
    default:
      return true
  }
}

/**
 * Apply filters to task array
 * @param tasks - Array of tasks to filter
 * @param filter - Filter state with criteria
 * @param taskTags - Map of taskId to array of tagIds
 */
export function applyFilters(
  tasks: Task[],
  filter: FilterState,
  taskTags: Map<string, string[]>
): Task[] {
  return tasks.filter((task) => {
    // Priority filter
    if (filter.priority !== null && task.priority !== filter.priority) {
      return false
    }

    // Due date range filter
    if (!matchesDueDateRange(task.due_date, filter.dueDateRange)) {
      return false
    }

    // Tag filter - task must have at least one matching tag
    if (filter.tagIds.length > 0) {
      const tags = taskTags.get(task.id) ?? []
      const hasMatchingTag = filter.tagIds.some((tagId) => tags.includes(tagId))
      if (!hasMatchingTag) {
        return false
      }
    }

    // Show done filter
    if (!filter.showDone && task.status === 'done') {
      return false
    }

    // Show archived filter
    if (!filter.showArchived && task.archived_at !== null) {
      return false
    }

    // Hide sub-tasks unless toggle is on
    if (!filter.showSubTasks && task.parent_id) {
      return false
    }

    // Always hide temporary tasks (ephemeral terminal tabs)
    if (task.is_temporary) {
      return false
    }

    return true
  })
}
