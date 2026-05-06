import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { Task } from '@slayzone/task/shared'
import type { Project } from '@slayzone/projects/shared'

export interface SidebarViewContext {
  projects: Project[]
  tasks: Task[]
  selectedProjectId: string
  onSelectProject: (id: string) => void
  onProjectSettings: (project: Project) => void
  onTaskClick?: (taskId: string) => void
  onReorderProjects: (projectIds: string[]) => void
  idleByProject?: Map<string, number>
}

export interface SidebarView {
  id: string
  label: string
  icon: LucideIcon
  /** Tailwind width class used when the view is not resizable (or as fallback). */
  width: string
  footerLayout: 'vertical' | 'horizontal'
  /** When true, the sidebar exposes a drag handle and a persisted custom width applies. */
  resizable?: boolean
  /** Pixel width used as the starting/reset value when the view first becomes resizable. */
  defaultWidth?: number
  minWidth?: number
  maxWidth?: number
  render: (ctx: SidebarViewContext) => ReactNode
}
