export type TelemetryTier = 'anonymous' | 'opted_in'

export type TelemetryEventName =
  | 'app_opened'
  | 'task_created'
  | 'task_completed'
  | 'terminal_opened'
  | 'project_created'
  | 'search_used'

export interface TelemetryEventProps {
  app_opened: { version: string }
  task_created: Record<string, never>
  task_completed: Record<string, never>
  terminal_opened: { mode: string }
  project_created: Record<string, never>
  search_used: Record<string, never>
}
