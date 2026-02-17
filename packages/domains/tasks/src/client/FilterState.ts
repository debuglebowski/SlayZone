export type GroupKey = 'status' | 'priority' | 'due_date'
export type DueDateRange = 'all' | 'overdue' | 'today' | 'week' | 'later'
export type SortKey = 'manual' | 'priority' | 'due_date' | 'title' | 'created'

export interface FilterState {
  groupBy: GroupKey
  sortBy: SortKey
  priority: number | null // null = all priorities
  dueDateRange: DueDateRange
  tagIds: string[] // selected tag IDs
  showDone: boolean
  showArchived: boolean
  showSubTasks: boolean
}

export const defaultFilterState: FilterState = {
  groupBy: 'status',
  sortBy: 'manual',
  priority: null,
  dueDateRange: 'all',
  tagIds: [],
  showDone: true,
  showArchived: false,
  showSubTasks: false
}
