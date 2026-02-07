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
  const abbrev = project.name.slice(0, 2).toUpperCase()

  return (
    <Tooltip>
      <ContextMenu>
        <TooltipTrigger asChild>
          <ContextMenuTrigger asChild>
            <motion.button
              onClick={onClick}
              className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center',
                'text-xs font-semibold text-white transition-all',
                selected && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
              )}
              style={{ backgroundColor: project.color }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              animate={selected ? { scale: 1.05 } : { scale: 1 }}
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
