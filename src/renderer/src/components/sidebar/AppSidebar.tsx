import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { ProjectItem } from "./ProjectItem"
import { cn } from "@/lib/utils"
import type { Project } from "../../../../shared/types/database"

interface AppSidebarProps {
  projects: Project[]
  selectedProjectId: string | null
  onSelectProject: (id: string | null) => void
  onAddProject: () => void
  onProjectSettings: (project: Project) => void
  onProjectDelete: (project: Project) => void
}

export function AppSidebar({
  projects,
  selectedProjectId,
  onSelectProject,
  onAddProject,
  onProjectSettings,
  onProjectDelete,
}: AppSidebarProps) {
  return (
    <Sidebar collapsible="none" className="w-16 border-r">
      <SidebarContent className="py-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="flex flex-col items-center gap-2">
              {/* All projects button */}
              <SidebarMenuItem>
                <button
                  onClick={() => onSelectProject(null)}
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
                    "text-xs font-semibold bg-muted transition-all",
                    "hover:scale-105",
                    selectedProjectId === null && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                  )}
                  title="All projects"
                >
                  All
                </button>
              </SidebarMenuItem>

              {/* Project blobs */}
              {projects.map((project) => (
                <SidebarMenuItem key={project.id}>
                  <ProjectItem
                    project={project}
                    selected={selectedProjectId === project.id}
                    onClick={() => onSelectProject(project.id)}
                    onSettings={() => onProjectSettings(project)}
                    onDelete={() => onProjectDelete(project)}
                  />
                </SidebarMenuItem>
              ))}

              {/* Add project button */}
              <SidebarMenuItem>
                <button
                  onClick={onAddProject}
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
                    "text-lg text-muted-foreground border-2 border-dashed",
                    "hover:border-primary hover:text-primary transition-colors"
                  )}
                  title="Add project"
                >
                  +
                </button>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
