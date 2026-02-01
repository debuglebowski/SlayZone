export interface DetectedWorktree {
  path: string
  branch: string | null
  isMain: boolean
}

export interface MergeResult {
  success: boolean
  merged: boolean
  conflicted: boolean
  error?: string
}
