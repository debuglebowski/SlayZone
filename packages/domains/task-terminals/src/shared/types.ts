import type { TerminalMode } from '@slayzone/terminal/shared'

export interface TerminalTab {
  id: string           // UUID or "main"
  taskId: string
  groupId: string      // tabs with same groupId render side-by-side
  label: string | null
  mode: TerminalMode
  isMain: boolean
  position: number
  createdAt: string
}

export interface TerminalGroup {
  id: string           // = groupId
  tabs: TerminalTab[]  // sorted by position
  isMain: boolean      // true if contains the main tab
}

export interface CreateTerminalTabInput {
  taskId: string
  mode?: TerminalMode
  label?: string
}

export interface UpdateTerminalTabInput {
  id: string
  label?: string | null
  mode?: TerminalMode
  position?: number
}
