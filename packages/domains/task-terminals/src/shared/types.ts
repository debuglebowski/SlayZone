import type { TerminalMode } from '@slayzone/terminal/shared'

export interface TerminalTab {
  id: string           // UUID or "main"
  taskId: string
  label: string | null
  mode: TerminalMode
  isMain: boolean
  position: number
  createdAt: string
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
