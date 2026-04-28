// -- Trigger --

export type TriggerType =
  | 'task_status_change'
  | 'task_created'
  | 'task_archived'
  | 'task_tag_changed'
  | 'cron'
  | 'manual'

export interface TriggerConfig {
  type: TriggerType
  params: Record<string, unknown>
}

// -- Condition --

export type ConditionType = 'task_property'

export interface ConditionConfig {
  type: ConditionType
  params: Record<string, unknown>
}

// -- Action --

export type ActionType = 'run_command' | 'ai'

export interface ActionConfig {
  type: ActionType
  params: Record<string, unknown>
}

export interface RunCommandActionParams {
  command: string
  cwd?: string
}

/**
 * AI action — run a configured AI provider in headless mode with a prompt.
 *
 * `provider` is a terminal mode id (e.g. 'claude-code', 'codex'). The engine
 * derives the non-interactive shell invocation from the provider's type.
 */
export interface AiActionParams {
  provider: string
  prompt: string
  flags?: string
  cwd?: string
}

// -- Automation --

export interface Automation {
  id: string
  project_id: string
  name: string
  description: string | null
  enabled: boolean
  trigger_config: TriggerConfig
  conditions: ConditionConfig[]
  actions: ActionConfig[]
  run_count: number
  last_run_at: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface AutomationRun {
  id: string
  automation_id: string
  trigger_event: unknown
  status: 'running' | 'success' | 'error' | 'skipped'
  error: string | null
  duration_ms: number | null
  started_at: string
  completed_at: string | null
}

// -- Inputs --

export interface CreateAutomationInput {
  project_id: string
  name: string
  description?: string
  trigger_config: TriggerConfig
  conditions?: ConditionConfig[]
  actions: ActionConfig[]
}

export interface UpdateAutomationInput {
  id: string
  name?: string
  description?: string
  enabled?: boolean
  trigger_config?: TriggerConfig
  conditions?: ConditionConfig[]
  actions?: ActionConfig[]
  sort_order?: number
}

// -- Events --

export interface AutomationEvent {
  type: TriggerType
  taskId?: string
  projectId?: string
  oldStatus?: string
  newStatus?: string
  tagIds?: string[]
  cronExpression?: string
  automationId?: string
  depth?: number
}

// -- DB row (raw from SQLite, JSON not yet parsed) --

export interface AutomationRow {
  id: string
  project_id: string
  name: string
  description: string | null
  enabled: number
  trigger_config: string
  conditions: string | null
  actions: string
  run_count: number
  last_run_at: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export function parseAutomationRow(row: AutomationRow): Automation {
  return {
    ...row,
    enabled: row.enabled === 1,
    trigger_config: JSON.parse(row.trigger_config),
    conditions: row.conditions ? JSON.parse(row.conditions) : [],
    actions: JSON.parse(row.actions),
  }
}
