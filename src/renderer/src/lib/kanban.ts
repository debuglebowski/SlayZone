import type { Task, TaskStatus } from '../../../shared/types/database'

export type GroupKey = 'status' | 'priority' | 'due_date'

export interface Column {
  id: string
  title: string
  tasks: Task[]
}

export const STATUS_ORDER: TaskStatus[] = [
  'inbox',
  'backlog',
  'todo',
  'in_progress',
  'review',
  'done'
]

export const STATUS_LABELS: Record<TaskStatus, string> = {
  inbox: 'Inbox',
  backlog: 'Backlog',
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done'
}

const PRIORITY_LABELS: Record<number, string> = {
  1: 'P1 - Critical',
  2: 'P2 - High',
  3: 'P3 - Medium',
  4: 'P4 - Low',
  5: 'P5 - None'
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

export function addDaysISO(date: string, days: number): string {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function groupByStatus(tasks: Task[]): Column[] {
  return STATUS_ORDER.map((status) => ({
    id: status,
    title: STATUS_LABELS[status],
    tasks: tasks.filter((t) => t.status === status)
  }))
}

function groupByPriority(tasks: Task[]): Column[] {
  return [1, 2, 3, 4, 5].map((priority) => ({
    id: `p${priority}`,
    title: PRIORITY_LABELS[priority],
    tasks: tasks.filter((t) => t.priority === priority)
  }))
}

function groupByDueDate(tasks: Task[]): Column[] {
  const today = todayISO()
  const weekEnd = addDaysISO(today, 7)

  const overdue: Task[] = []
  const todayTasks: Task[] = []
  const thisWeek: Task[] = []
  const later: Task[] = []
  const noDate: Task[] = []

  for (const task of tasks) {
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

export function groupTasksBy(tasks: Task[], groupBy: GroupKey): Column[] {
  // Filter out subtasks - only show root tasks
  const rootTasks = tasks.filter((t) => t.parent_id === null)

  switch (groupBy) {
    case 'status':
      return groupByStatus(rootTasks)
    case 'priority':
      return groupByPriority(rootTasks)
    case 'due_date':
      return groupByDueDate(rootTasks)
  }
}
