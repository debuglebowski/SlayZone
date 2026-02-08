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
  name: string
  slug: string
  content?: string
  metadataJson?: string
}

export interface UpdateAiConfigItemInput {
  id: string
  type?: AiConfigItemType
  scope?: AiConfigScope
  projectId?: string | null
  name?: string
  slug?: string
  content?: string
  metadataJson?: string
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

export interface AiConfigSourcePlaceholder {
  id: string
  name: string
  kind: string
  enabled: boolean
  status: string
  last_checked_at: string | null
  created_at: string
  updated_at: string
}

export interface CreateAiConfigSourcePlaceholderInput {
  name: string
  kind: string
  enabled?: boolean
  status?: string
}
