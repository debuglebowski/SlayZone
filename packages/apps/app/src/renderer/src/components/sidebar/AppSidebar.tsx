import { Settings, HelpCircle, BrainCircuit } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem
} from '@slayzone/ui'
import { Button } from '@slayzone/ui'
import { Tooltip, TooltipTrigger, TooltipContent } from '@slayzone/ui'
import { ProjectItem } from './ProjectItem'
import { TerminalStatusPopover } from '@slayzone/terminal'
import { cn } from '@slayzone/ui'
import type { Task } from '@slayzone/task/shared'
import type { Project } from '@slayzone/projects/shared'

interface AppSidebarProps {
  projects: Project[]
  tasks: Task[]
  selectedProjectId: string | null
  onSelectProject: (id: string | null) => void
  onAddProject: () => void
  onProjectSettings: (project: Project) => void
  onProjectDelete: (project: Project) => void
  onSettings: () => void
  onTutorial: () => void
  onAiCenter: () => void
  aiCenterActive: boolean
}

export function AppSidebar({
  projects,
  tasks,
  selectedProjectId,
  onSelectProject,
  onAddProject,
  onProjectSettings,
  onProjectDelete,
  onSettings,
  onTutorial,
  onAiCenter,
  aiCenterActive
}: AppSidebarProps) {
  return (
    <Sidebar collapsible="none" className="w-[72px] border-r min-h-svh">
      {/* Draggable region for window movement - clears traffic lights */}
      <div className="h-10 window-drag-region" />
      <SidebarContent className="py-4 pt-0">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="flex flex-col items-center gap-2">
              {/* All projects button */}
              <SidebarMenuItem>
                <button
                  onClick={() => onSelectProject(null)}
                  className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center',
                    'text-xs font-semibold bg-muted transition-all',
                    'hover:scale-105',
                    selectedProjectId === null &&
                      'ring-2 ring-primary ring-offset-2 ring-offset-background'
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
                    'w-10 h-10 rounded-lg flex items-center justify-center',
                    'text-lg text-muted-foreground border-2 border-dashed',
                    'hover:border-primary hover:text-primary transition-colors'
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
          <SidebarMenuItem className="flex flex-col items-center gap-2">
            <TerminalStatusPopover tasks={tasks} />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-lg"
                  onClick={onTutorial}
                  className="rounded-lg text-muted-foreground"
                >
                  <HelpCircle className="size-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Tutorial</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-lg"
                  onClick={onAiCenter}
                  className={cn(
                    'rounded-lg text-muted-foreground',
                    aiCenterActive && 'text-primary bg-primary/10'
                  )}
                >
                  <BrainCircuit className="size-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">AI Config Center</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-lg"
                  onClick={onSettings}
                  className="rounded-lg text-muted-foreground"
                >
                  <Settings className="size-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Settings</TooltipContent>
            </Tooltip>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
