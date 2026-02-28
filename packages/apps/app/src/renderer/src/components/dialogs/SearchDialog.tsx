import { useMemo } from 'react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from '@slayzone/ui'
import {
  Folder,
  CheckSquare,
  Plus,
  Settings,
  Sun,
  Moon,
  Monitor,
  Maximize2,
  LayoutGrid,
  TerminalSquare,
  Keyboard,
  Megaphone,
  Compass,
  type LucideIcon
} from 'lucide-react'
import type { Task } from '@slayzone/task/shared'
import type { Project } from '@slayzone/projects/shared'

export interface CommandPaletteCommand {
  id: string
  label: string
  icon: LucideIcon
  shortcut?: string
  action: () => void
  keywords?: string[]
}

interface SearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tasks: Task[]
  projects: Project[]
  onSelectTask: (taskId: string) => void
  onSelectProject: (projectId: string) => void
  commands?: CommandPaletteCommand[]
}

/** Predefined command factory — call in App.tsx with the relevant callbacks */
export function buildDefaultCommands(actions: {
  createTask: () => void
  createProject: () => void
  openSettings: () => void
  toggleTheme: () => void
  toggleZenMode: () => void
  toggleExplodeMode: () => void
  newScratchTerminal: () => void
  openShortcuts?: () => void
  openChangelog: () => void
  openTour: () => void
  currentTheme: string
}): CommandPaletteCommand[] {
  const commands: CommandPaletteCommand[] = [
    { id: 'new-task', label: 'New Task', icon: Plus, shortcut: '⌘N', action: actions.createTask, keywords: ['create', 'add'] },
    { id: 'new-project', label: 'New Project', icon: Folder, action: actions.createProject, keywords: ['create', 'add'] },
    { id: 'open-settings', label: 'Settings', icon: Settings, shortcut: '⌘,', action: actions.openSettings },
    {
      id: 'toggle-theme',
      label: actions.currentTheme === 'dark' ? 'Switch to Light Mode' : actions.currentTheme === 'light' ? 'Switch to Dark Mode' : 'Toggle Theme',
      icon: actions.currentTheme === 'dark' ? Sun : actions.currentTheme === 'light' ? Moon : Monitor,
      action: actions.toggleTheme,
      keywords: ['dark', 'light', 'theme', 'appearance']
    },
    { id: 'zen-mode', label: 'Toggle Zen Mode', icon: Maximize2, shortcut: '⌘J', action: actions.toggleZenMode, keywords: ['focus', 'distraction'] },
    { id: 'explode-mode', label: 'Toggle Explode Mode', icon: LayoutGrid, shortcut: '⌘⇧E', action: actions.toggleExplodeMode, keywords: ['split', 'grid'] },
    { id: 'scratch-terminal', label: 'New Scratch Terminal', icon: TerminalSquare, action: actions.newScratchTerminal, keywords: ['shell', 'console'] },
    { id: 'changelog', label: "What's New", icon: Megaphone, action: actions.openChangelog, keywords: ['release', 'updates'] },
    { id: 'tour', label: 'Take a Tour', icon: Compass, action: actions.openTour, keywords: ['tutorial', 'onboarding', 'help'] }
  ]
  if (actions.openShortcuts) {
    commands.splice(7, 0, { id: 'shortcuts', label: 'Keyboard Shortcuts', icon: Keyboard, action: actions.openShortcuts })
  }
  return commands
}

export function SearchDialog({
  open,
  onOpenChange,
  tasks,
  projects,
  onSelectTask,
  onSelectProject,
  commands = []
}: SearchDialogProps) {
  const taskItems = useMemo(
    () =>
      tasks.map((task) => ({
        ...task,
        projectName: projects.find((p) => p.id === task.project_id)?.name ?? ''
      })),
    [tasks, projects]
  )

  const runCommand = (cmd: CommandPaletteCommand) => {
    cmd.action()
    onOpenChange(false)
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search tasks, projects, and commands..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {commands.length > 0 && (
          <CommandGroup heading="Commands">
            {commands.map((cmd) => (
              <CommandItem
                key={cmd.id}
                value={cmd.label}
                keywords={cmd.keywords}
                onSelect={() => runCommand(cmd)}
              >
                <cmd.icon className="mr-2 h-4 w-4" />
                <span className="flex-1">{cmd.label}</span>
                {cmd.shortcut && (
                  <kbd className="ml-auto text-xs text-muted-foreground tracking-widest">
                    {cmd.shortcut}
                  </kbd>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {(commands.length > 0 && (projects.length > 0 || tasks.length > 0)) && (
          <CommandSeparator />
        )}

        {projects.length > 0 && (
          <CommandGroup heading="Projects">
            {projects.map((project) => (
              <CommandItem
                key={project.id}
                value={project.name}
                onSelect={() => {
                  onSelectProject(project.id)
                  onOpenChange(false)
                }}
              >
                <Folder className="mr-2 h-4 w-4" />
                <span>{project.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {taskItems.length > 0 && (
          <CommandGroup heading="Tasks">
            {taskItems.map((task) => (
              <CommandItem
                key={task.id}
                value={task.title}
                keywords={[task.projectName].filter(Boolean)}
                onSelect={() => {
                  onSelectTask(task.id)
                  onOpenChange(false)
                }}
              >
                <CheckSquare className="mr-2 h-4 w-4" />
                <span className="flex-1 truncate">{task.title}</span>
                {task.projectName && (
                  <span className="ml-2 text-xs text-muted-foreground truncate max-w-32">
                    {task.projectName}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}
