export interface DirEntry {
  name: string
  /** Relative path from project root (e.g. "src/main/index.ts") */
  path: string
  type: 'file' | 'directory'
}
