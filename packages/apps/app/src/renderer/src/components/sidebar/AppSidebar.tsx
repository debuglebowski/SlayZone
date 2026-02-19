import { useState } from 'react'
import { Settings, HelpCircle, Keyboard, ChevronDown } from 'lucide-react'
import * as Collapsible from '@radix-ui/react-collapsible'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@slayzone/ui'
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
  zenMode?: boolean
}

const isMac = navigator.platform.startsWith('Mac')

const shortcutGroups = [
  { heading: 'General', items: [
    { label: 'New Task', keys: isMac ? '⌘ N' : 'Ctrl N' },
    { label: 'Search', keys: isMac ? '⌘ K' : 'Ctrl K' },
    { label: 'Complete & Close Tab', keys: isMac ? '⌘ ⇧ D' : 'Ctrl ⇧ D' },
    { label: 'Zen Mode', keys: isMac ? '⌘ J' : 'Ctrl J' },
    { label: 'Explode Mode', keys: isMac ? '⌘ ⇧ E' : 'Ctrl ⇧ E' },
    { label: 'Exit Zen / Explode', keys: 'Esc' },
    { label: 'Global Settings', keys: isMac ? '⌘ ,' : 'Ctrl ,' },
    { label: 'Project Settings', keys: isMac ? '⌘ ⇧ ,' : 'Ctrl ⇧ ,' },
    ...(isMac ? [{ label: 'Go Home', keys: '⌘ §' }] : []),
  ]},
  { heading: 'Tabs', items: [
    { label: 'Close Sub-panel / Tab', keys: isMac ? '⌘ W' : 'Ctrl W' },
    { label: 'Close Task', keys: isMac ? '⌘ ⇧ W' : 'Ctrl ⇧ W' },
    { label: 'Switch Tab 1–9', keys: isMac ? '⌘ 1–9' : 'Ctrl 1–9' },
    { label: 'Next Tab', keys: '^ Tab' },
    { label: 'Previous Tab', keys: '^ ⇧ Tab' },
    { label: 'Reopen Closed Tab', keys: isMac ? '⌘ ⇧ T' : 'Ctrl ⇧ T' },
    { label: 'New Temporary Task', keys: isMac ? '⌘ ⇧ N' : 'Ctrl ⇧ N' },
  ]},
  { heading: 'Task Panels', items: [
    { label: 'Terminal', keys: '⌘ T' },
    { label: 'Browser', keys: '⌘ B' },
    { label: 'Editor', keys: '⌘ E' },
    { label: 'Quick Open File', keys: '⌘ P' },
    { label: 'Git', keys: '⌘ G' },
    { label: 'Git Diff', keys: '⌘ ⇧ G' },
    { label: 'Settings', keys: '⌘ S' },
  ]},
  { heading: 'Terminal', items: [
    { label: 'Inject Title', keys: '⌘ I' },
    { label: 'Inject Description', keys: '⌘ ⇧ I' },
    { label: 'Screenshot', keys: '⌘ ⇧ S' },
    { label: 'Search', keys: '⌘ F' },
    { label: 'Clear Buffer', keys: '⌘ ⇧ K' },
    { label: 'New Group', keys: '⌘ T' },
    { label: 'Split', keys: '⌘ D' },
  ]},
]

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
  zenMode,
}: AppSidebarProps) {
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  return (
    <Sidebar collapsible="none" className={zenMode ? "!w-0 min-h-svh overflow-hidden" : "w-16 min-h-svh"}>
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
                  onClick={() => setShortcutsOpen(true)}
                  className="rounded-lg text-muted-foreground"
                >
                  <Keyboard className="size-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Keyboard Shortcuts</TooltipContent>
            </Tooltip>
            <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
              <DialogContent className="max-h-[80vh] flex flex-col">
                <DialogHeader>
                  <DialogTitle>Keyboard Shortcuts</DialogTitle>
                  <DialogDescription className="sr-only">List of keyboard shortcuts</DialogDescription>
                </DialogHeader>
                <div className="space-y-1 overflow-y-auto scrollbar-thin">
                  {shortcutGroups.map((group, i) => (
                    <Collapsible.Root key={group.heading} defaultOpen={i === 0}>
                      <Collapsible.Trigger className="flex w-full items-center justify-between px-3 py-2 rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-colors group/trigger">
                        <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">{group.heading}</p>
                        <ChevronDown className="size-3.5 text-muted-foreground transition-transform duration-200 group-data-[state=open]/trigger:rotate-180" />
                      </Collapsible.Trigger>
                      <Collapsible.Content className="data-[state=closed]:hidden">
                        <div className="rounded-lg border divide-y mb-3">
                          {group.items.map((s) => (
                            <div key={s.label} className="flex items-center justify-between px-3 py-2">
                              <span className="text-sm">{s.label}</span>
                              <span className="text-base text-muted-foreground bg-muted border px-2.5 py-0.5 rounded-md font-[system-ui] shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">{s.keys}</span>
                            </div>
                          ))}
                        </div>
                      </Collapsible.Content>
                    </Collapsible.Root>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
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
