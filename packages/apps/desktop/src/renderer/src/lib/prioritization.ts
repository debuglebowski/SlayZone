import { differenceInDays, parseISO, startOfDay } from 'date-fns'
import type { Task } from '@omgslayzone/task/shared'

export function calculatePriorityScore(task: Task): number {
  // Skip done tasks
  if (task.status === 'done') return -Infinity

  // Base score from priority (P1=1000, P2=800, P3=600, P4=400, P5=200)
  const priorityScore = (6 - task.priority) * 200

  // Due date urgency
  let dueDateScore = 0
  if (task.due_date) {
    const today = startOfDay(new Date())
    const dueDate = startOfDay(parseISO(task.due_date))
    const daysUntilDue = differenceInDays(dueDate, today)

    if (daysUntilDue < 0) {
      // Overdue: big boost, capped
      dueDateScore = 500 + Math.min(Math.abs(daysUntilDue) * 50, 500)
    } else if (daysUntilDue === 0) {
      dueDateScore = 400 // Due today
    } else if (daysUntilDue <= 3) {
      dueDateScore = 300 - daysUntilDue * 50 // Due soon
    } else if (daysUntilDue <= 7) {
      dueDateScore = 100 // Due this week
    }
  }

  // Status boost
  let statusScore = 0
  if (task.status === 'in_progress') statusScore = 100
  else if (task.status === 'review') statusScore = 75
  else if (task.status === 'todo') statusScore = 50

  return priorityScore + dueDateScore + statusScore
}

export function getNextTask(tasks: Task[]): Task | null {
  const scored = tasks
    .map((task) => ({ task, score: calculatePriorityScore(task) }))
    .filter((s) => s.score > -Infinity)
    .sort((a, b) => b.score - a.score)

  return scored[0]?.task ?? null
}
