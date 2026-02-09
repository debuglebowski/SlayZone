export type AiConfigItemType = 'skill' | 'command' | 'doc'
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
  target_path: string
  selected_at: string
}

export interface SetAiConfigProjectSelectionInput {
  projectId: string
  itemId: string
  targetPath: string
}

export type ContextFileCategory = 'claude' | 'agents' | 'cursorrules' | 'copilot' | 'mcp' | 'custom'

export interface ContextFileInfo {
  path: string
  name: string
  exists: boolean
  category: ContextFileCategory
}

export type ContextFileSyncStatus = 'synced' | 'out_of_sync' | 'local_only'

export type ContextFileProvider = 'claude' | 'codex' | 'manual'

export interface ContextTreeEntry {
  path: string
  relativePath: string
  exists: boolean
  category: ContextFileCategory | 'skill' | 'command'
  linkedItemId: string | null
  syncStatus: ContextFileSyncStatus
}

export interface LoadGlobalItemInput {
  projectId: string
  projectPath: string
  itemId: string
  provider: ContextFileProvider
  manualPath?: string
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
