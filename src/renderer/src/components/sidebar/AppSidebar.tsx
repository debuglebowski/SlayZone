import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
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
  onSettings: () => void
}

export function AppSidebar({
  projects,
  selectedProjectId,
  onSelectProject,
  onAddProject,
  onProjectSettings,
  onProjectDelete,
  onSettings,
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
      <SidebarFooter className="py-4">
        <SidebarMenu>
          <SidebarMenuItem className="flex justify-center">
            <button
              onClick={onSettings}
              className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center",
                "text-muted-foreground hover:bg-muted transition-colors"
              )}
              title="Settings"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
