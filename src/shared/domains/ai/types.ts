export interface ClaudeAvailability {
  available: boolean
  path: string | null
  version: string | null
}

export interface GenerateDescriptionResult {
  success: boolean
  description?: string
  error?: string
}
