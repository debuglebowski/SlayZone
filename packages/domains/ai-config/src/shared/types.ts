export type AiConfigItemType = 'skill' | 'command' | 'doc' | 'root_instructions'
export type AiConfigScope = 'global' | 'project'

export interface AiConfigItem {
  id: string
  type: AiConfigItemType
  scope: AiConfigScope
  project_id: string | null
  name: string
  slug: string
  content: string
  metadata_json: string
  created_at: string
  updated_at: string
}

export interface ListAiConfigItemsInput {
  scope: AiConfigScope
  projectId?: string | null
  type?: AiConfigItemType
}

export interface CreateAiConfigItemInput {
  type: AiConfigItemType
  scope: AiConfigScope
  projectId?: string | null
  slug: string
  content?: string
}

export interface UpdateAiConfigItemInput {
  id: string
  type?: AiConfigItemType
  scope?: AiConfigScope
  projectId?: string | null
  slug?: string
  content?: string
}

export interface AiConfigProjectSelection {
  id: string
  project_id: string
  item_id: string
  provider: string
  target_path: string
  content_hash: string | null
  selected_at: string
}

export interface SetAiConfigProjectSelectionInput {
  projectId: string
  itemId: string
  targetPath: string
}

export type ContextFileCategory = 'claude' | 'codex' | 'agents' | 'mcp' | 'custom'

export interface ContextFileInfo {
  path: string
  name: string
  exists: boolean
  category: ContextFileCategory
}

export type ContextFileSyncStatus = 'synced' | 'out_of_sync' | 'local_only'

// CLI provider types
export type CliProvider = 'claude' | 'codex' | 'cursor' | 'gemini' | 'opencode'
export type CliProviderStatus = 'active' | 'placeholder'

export interface CliProviderInfo {
  id: string
  name: string
  kind: string
  enabled: boolean
  status: CliProviderStatus
}

export type ContextFileProvider = CliProvider | 'manual'

export interface ContextTreeEntry {
  path: string
  relativePath: string
  exists: boolean
  category: ContextFileCategory | 'skill' | 'command'
  provider?: CliProvider
  linkedItemId: string | null
  syncStatus: ContextFileSyncStatus
}

export interface LoadGlobalItemInput {
  projectId: string
  projectPath: string
  itemId: string
  providers: CliProvider[]
  manualPath?: string
}

export interface ProviderPathMapping {
  rootInstructions: string | null
  skillsDir: string | null
  commandsDir: string | null
}

export interface SyncAllInput {
  projectId: string
  projectPath: string
  providers?: CliProvider[]
}

export interface SyncResult {
  written: { path: string; provider: CliProvider }[]
  conflicts: SyncConflict[]
}

export interface SyncConflict {
  path: string
  provider: CliProvider
  itemId: string
  reason: 'external_edit'
}

// Root instructions + skills status
export type ProviderSyncStatus = 'synced' | 'out_of_sync' | 'not_synced'

export interface RootInstructionsResult {
  content: string
  providerStatus: Partial<Record<CliProvider, ProviderSyncStatus>>
}

export interface ProjectSkillStatus {
  item: AiConfigItem
  providers: Partial<Record<CliProvider, { path: string; status: ProviderSyncStatus }>>
}

// Global file management
export interface GlobalFileEntry {
  path: string
  name: string
  provider: string
  category: 'instructions' | 'skill' | 'command'
  exists: boolean
}

// MCP server management
export type McpProvider = 'claude' | 'cursor' | 'vscode'

export interface McpServerConfig {
  command: string
  args: string[]
  env?: Record<string, string>
  type?: string
}

export interface McpConfigFileResult {
  provider: McpProvider
  exists: boolean
  servers: Record<string, McpServerConfig>
}

export interface ProjectMcpServer {
  id: string
  name: string
  config: McpServerConfig
  curated: boolean
  providers: McpProvider[]
  category?: string
}

export interface WriteMcpServerInput {
  projectPath: string
  provider: McpProvider
  serverKey: string
  config: McpServerConfig
}

export interface RemoveMcpServerInput {
  projectPath: string
  provider: McpProvider
  serverKey: string
}
