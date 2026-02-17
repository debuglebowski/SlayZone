export interface DirEntry {
  name: string
  /** Relative path from project root (e.g. "src/main/index.ts") */
  path: string
  type: 'file' | 'directory'
  /** True if matched by .gitignore */
  ignored?: boolean
}

export interface ReadFileResult {
  content: string | null
  tooLarge?: boolean
  sizeBytes?: number
}

export interface EditorOpenFilesState {
  files: string[]
  activeFile: string | null
  treeWidth?: number
  treeVisible?: boolean
  expandedFolders?: string[]
}
