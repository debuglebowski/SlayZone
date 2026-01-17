import { cn } from "@/lib/utils"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import type { Project } from "../../../../shared/types/database"

interface ProjectItemProps {
  project: Project
  selected: boolean
  onClick: () => void
  onSettings: () => void
  onDelete: () => void
}

export function ProjectItem({ project, selected, onClick, onSettings, onDelete }: ProjectItemProps) {
  const abbrev = project.name.slice(0, 2).toUpperCase()

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center",
            "text-xs font-semibold text-white transition-all",
            "hover:scale-105",
            selected && "ring-2 ring-primary ring-offset-2 ring-offset-background"
          )}
          style={{ backgroundColor: project.color }}
          title={project.name}
        >
          {abbrev}
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={onSettings}>
          Settings
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={onDelete} className="text-destructive">
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
