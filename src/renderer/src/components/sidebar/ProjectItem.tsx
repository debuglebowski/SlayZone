import { cn } from "@/lib/utils"
import type { Project } from "../../../../shared/types/database"

interface ProjectItemProps {
  project: Project
  selected: boolean
  onClick: () => void
}

export function ProjectItem({ project, selected, onClick }: ProjectItemProps) {
  const abbrev = project.name.slice(0, 2).toUpperCase()

  return (
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
  )
}
