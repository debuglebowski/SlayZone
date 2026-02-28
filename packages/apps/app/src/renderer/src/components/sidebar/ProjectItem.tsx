import { motion } from 'framer-motion'
import { cn } from '@slayzone/ui'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@slayzone/ui'
import { Tooltip, TooltipTrigger, TooltipContent } from '@slayzone/ui'
import type { Project } from '@slayzone/projects/shared'

function getProjectTextColor(color: string): string {
  const raw = color.trim().replace('#', '')
  if (!/^[\da-fA-F]{3,8}$/.test(raw)) return '#ffffff'

  const hex = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw.slice(0, 6)
  if (hex.length !== 6) return '#ffffff'

  const chunks = hex.match(/.{2}/g)
  if (!chunks) return '#ffffff'

  const [r, g, b] = chunks.map((chunk) => parseInt(chunk, 16) / 255)
  const [lr, lg, lb] = [r, g, b].map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  )
  const luminance = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb

  return luminance > 0.45 ? '#111827' : '#ffffff'
}

interface ProjectItemProps {
  project: Project
  selected: boolean
  onClick: () => void
  onSettings: () => void
  onDelete: () => void
}

export function ProjectItem({
  project,
  selected,
  onClick,
  onSettings,
  onDelete
}: ProjectItemProps) {
  const capitals = project.name.match(/[A-Z]/g) ?? []
  const abbrev = capitals.length >= 2 ? capitals.slice(0, 2).join('') : project.name.slice(0, 2).toUpperCase()
  const textColor = getProjectTextColor(project.color)

  return (
    <Tooltip>
      <ContextMenu>
        <TooltipTrigger asChild>
          <ContextMenuTrigger asChild>
            <motion.button
              onClick={onClick}
              className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center',
                'text-xs font-semibold transition-all focus-visible:outline-none',
                'focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar',
                selected && 'ring-2 ring-primary ring-offset-2 ring-offset-sidebar shadow-sm'
              )}
              style={{ backgroundColor: project.color, color: textColor }}
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.95 }}
              animate={selected ? { scale: 1.03 } : { scale: 1 }}
              transition={{ type: 'spring', stiffness: 1800, damping: 50 }}
            >
              {abbrev}
            </motion.button>
          </ContextMenuTrigger>
        </TooltipTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={onSettings}>Settings</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={onDelete} className="text-destructive">
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <TooltipContent side="right">{project.name}</TooltipContent>
    </Tooltip>
  )
}
