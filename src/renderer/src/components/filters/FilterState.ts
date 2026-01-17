export type GroupKey = 'status' | 'priority' | 'due_date'
export type DueDateRange = 'all' | 'overdue' | 'today' | 'week' | 'later'

export interface FilterState {
  groupBy: GroupKey
  priority: number | null // null = all priorities
  dueDateRange: DueDateRange
  tagIds: string[] // selected tag IDs
  showBlocked: boolean
  showDone: boolean
  showArchived: boolean
}

export const defaultFilterState: FilterState = {
  groupBy: 'status',
  priority: null,
  dueDateRange: 'all',
  tagIds: [],
  showBlocked: true,
  showDone: true,
  showArchived: false
}
