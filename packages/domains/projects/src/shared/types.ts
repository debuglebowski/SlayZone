import type { ColumnConfig } from '@slayzone/workflow'

export type ExecutionContext =
  | { type: 'host' }
  | { type: 'docker'; container: string; workdir?: string; shell?: string }
  | { type: 'ssh'; target: string; workdir?: string; shell?: string }

export {
  WORKFLOW_CATEGORIES,
  DEFAULT_COLUMNS,
  type WorkflowCategory,
  type ColumnConfig
} from '@slayzone/workflow'

export interface Project {
  id: string
  name: string
  color: string
  path: string | null
  auto_create_worktree_on_task_create: number | null
  worktree_source_branch: string | null
  columns_config: ColumnConfig[] | null
  execution_context: ExecutionContext | null
  created_at: string
  updated_at: string
}

export interface CreateProjectInput {
  name: string
  color: string
  path?: string
  columnsConfig?: ColumnConfig[]
}

export interface UpdateProjectInput {
  id: string
  name?: string
  color?: string
  path?: string | null
  autoCreateWorktreeOnTaskCreate?: boolean | null
  worktreeSourceBranch?: string | null
  columnsConfig?: ColumnConfig[] | null
  executionContext?: ExecutionContext | null
}
