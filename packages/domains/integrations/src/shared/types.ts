export type IntegrationProvider = 'linear'
export type ExternalType = 'issue'
export type SyncState = 'active' | 'error' | 'paused'
export type IntegrationSyncMode = 'one_way' | 'two_way'

export interface IntegrationConnection {
  id: string
  provider: IntegrationProvider
  workspace_id: string
  workspace_name: string
  account_label: string
  credential_ref: string
  enabled: boolean
  created_at: string
  updated_at: string
  last_synced_at: string | null
}

export interface IntegrationConnectionPublic {
  id: string
  provider: IntegrationProvider
  workspace_id: string
  workspace_name: string
  account_label: string
  enabled: boolean
  created_at: string
  updated_at: string
  last_synced_at: string | null
}

export interface IntegrationProjectMapping {
  id: string
  project_id: string
  provider: IntegrationProvider
  connection_id: string
  external_team_id: string
  external_team_key: string
  external_project_id: string | null
  sync_mode: IntegrationSyncMode
  created_at: string
  updated_at: string
}

export interface ExternalLink {
  id: string
  provider: IntegrationProvider
  connection_id: string
  external_type: ExternalType
  external_id: string
  external_key: string
  external_url: string
  task_id: string
  sync_state: SyncState
  last_sync_at: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

export interface LinearTeam {
  id: string
  key: string
  name: string
}

export interface LinearProject {
  id: string
  name: string
  teamId: string
}

export interface ConnectLinearInput {
  apiKey: string
  accountLabel?: string
}

export interface SetProjectMappingInput {
  projectId: string
  provider: IntegrationProvider
  connectionId: string
  externalTeamId: string
  externalTeamKey: string
  externalProjectId?: string | null
  syncMode?: IntegrationSyncMode
}

export interface ImportLinearIssuesInput {
  projectId: string
  connectionId: string
  teamId?: string
  linearProjectId?: string
  selectedIssueIds?: string[]
  limit?: number
  cursor?: string | null
}

export interface ListLinearIssuesInput {
  connectionId: string
  projectId?: string
  teamId?: string
  linearProjectId?: string
  limit?: number
  cursor?: string | null
}

export interface ImportLinearIssuesResult {
  imported: number
  linked: number
  nextCursor: string | null
}

export interface SyncNowInput {
  connectionId?: string
  projectId?: string
  taskId?: string
}

export interface SyncNowResult {
  scanned: number
  pushed: number
  pulled: number
  conflictsResolved: number
  errors: string[]
  at: string
}

export interface LinearIssueSummary {
  id: string
  identifier: string
  title: string
  description: string | null
  priority: number
  updatedAt: string
  state: {
    id: string
    name: string
    type: string
  }
  assignee: {
    id: string
    name: string
  } | null
  team: {
    id: string
    key: string
    name: string
  }
  project: {
    id: string
    name: string
  } | null
  url: string
}
