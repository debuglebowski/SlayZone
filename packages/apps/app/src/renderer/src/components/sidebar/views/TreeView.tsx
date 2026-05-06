import { useMemo, useState, type ReactNode } from 'react'
import { ChevronDown, Settings } from 'lucide-react'
import * as Collapsible from '@radix-ui/react-collapsible'
import { cn } from '@slayzone/ui'
import { isInProgress, type Task } from '@slayzone/task/shared'
import { useTabStore } from '@slayzone/settings'
import { useIdleTasks, useActiveSessionTaskIds } from '@/components/agent-status/useIdleTasks'
import type { SidebarViewContext } from './types'

export function TreeView({
  projects,
  tasks,
  selectedProjectId,
  onSelectProject,
  onProjectSettings,
  onTaskClick,
}: SidebarViewContext) {
  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [projects]
  )

  const tasksByProject = useMemo(() => {
    const m = new Map<string, Task[]>()
    for (const t of tasks) {
      if (!isInProgress(t.status)) continue
      const arr = m.get(t.project_id) ?? []
      arr.push(t)
      m.set(t.project_id, arr)
    }
    return m
  }, [tasks])

  // For each in-progress task id → its in-progress children. Subtasks whose parent
  // is not in-progress are promoted to the project root.
  const childrenByParent = useMemo(() => {
    const inProgressIds = new Set<string>()
    for (const t of tasks) if (isInProgress(t.status)) inProgressIds.add(t.id)
    const m = new Map<string, Task[]>()
    for (const t of tasks) {
      if (!isInProgress(t.status)) continue
      const pid = t.parent_id
      if (pid && inProgressIds.has(pid)) {
        const arr = m.get(pid) ?? []
        arr.push(t)
        m.set(pid, arr)
      }
    }
    return m
  }, [tasks])

  const rootTasksByProject = useMemo(() => {
    const inProgressIds = new Set<string>()
    for (const t of tasks) if (isInProgress(t.status)) inProgressIds.add(t.id)
    const m = new Map<string, Task[]>()
    for (const t of tasks) {
      if (!isInProgress(t.status)) continue
      const isOrphan = !t.parent_id || !inProgressIds.has(t.parent_id)
      if (!isOrphan) continue
      const arr = m.get(t.project_id) ?? []
      arr.push(t)
      m.set(t.project_id, arr)
    }
    return m
  }, [tasks])

  const { idleTasks } = useIdleTasks(tasks, null)
  const idleByTask = useMemo(() => {
    const s = new Set<string>()
    for (const it of idleTasks) s.add(it.task.id)
    return s
  }, [idleTasks])

  const activeTaskId = useTabStore((s) => {
    const tab = s.tabs[s.activeTabIndex]
    return tab?.type === 'task' ? tab.taskId : null
  })
  const activeTabType = useTabStore((s) => s.tabs[s.activeTabIndex]?.type)
  const activeView = useTabStore((s) => s.activeView)
  const projectIsActive = (pid: string) =>
    selectedProjectId === pid && (activeTabType === 'home' || activeView === 'context')

  const tabs = useTabStore((s) => s.tabs)
  const openTabTaskIds = useMemo(() => {
    const ids = new Set<string>()
    for (const t of tabs) if (t.type === 'task') ids.add(t.taskId)
    return ids
  }, [tabs])

  const sessionTaskIds = useActiveSessionTaskIds()

  const activeProjectIds = useMemo(() => {
    const taskById = new Map(tasks.map((t) => [t.id, t]))
    const set = new Set<string>()
    for (const id of openTabTaskIds) {
      const pid = taskById.get(id)?.project_id
      if (pid) set.add(pid)
    }
    for (const id of sessionTaskIds) {
      const pid = taskById.get(id)?.project_id
      if (pid) set.add(pid)
    }
    return set
  }, [tasks, openTabTaskIds, sessionTaskIds])

  const [openProjects, setOpenProjects] = useState<Record<string, boolean>>(() =>
    selectedProjectId ? { [selectedProjectId]: true } : {}
  )

  const [showAll, setShowAll] = useState(false)

  const activeProjects = useMemo(
    () => sortedProjects.filter((p) => activeProjectIds.has(p.id)),
    [sortedProjects, activeProjectIds]
  )
  const hiddenProjects = useMemo(
    () => sortedProjects.filter((p) => !activeProjectIds.has(p.id)),
    [sortedProjects, activeProjectIds]
  )
  const visibleProjects = showAll ? sortedProjects : activeProjects

  const renderTask = (task: Task, depth: number): ReactNode => {
    const isActive = activeTaskId === task.id
    const isIdle = idleByTask.has(task.id)
    const children = childrenByParent.get(task.id) ?? []
    return (
      <div key={task.id}>
        <button
          type="button"
          onClick={() => onTaskClick?.(task.id)}
          style={{ paddingLeft: 8 + depth * 14 }}
          className={cn(
            'flex w-full items-center gap-2 rounded-md pr-2 py-1 text-sm text-left transition-colors',
            isActive
              ? 'bg-white/10 text-foreground'
              : 'text-muted-foreground hover:bg-accent/40 hover:text-accent-foreground'
          )}
        >
          {isIdle ? (
            <span
              aria-label="idle"
              className="size-1.5 rounded-full bg-primary shrink-0 animate-pulse"
            />
          ) : (
            <span className="size-1.5 rounded-full bg-muted-foreground/30 shrink-0" />
          )}
          <span className="truncate">{task.title || 'Untitled'}</span>
        </button>
        {children.map((c) => renderTask(c, depth + 1))}
      </div>
    )
  }

  const renderProject = (project: typeof sortedProjects[number]) => {
    const projectTasks = tasksByProject.get(project.id) ?? []
    const rootTasks = rootTasksByProject.get(project.id) ?? []
    const isOpen = openProjects[project.id] ?? false

    return (
      <Collapsible.Root
        key={project.id}
        open={isOpen}
        onOpenChange={(open) => setOpenProjects((s) => ({ ...s, [project.id]: open }))}
      >
        <div
          style={{
            backgroundColor: `color-mix(in oklch, ${project.color} ${projectIsActive(project.id) ? 22 : 10}%, transparent)`
          }}
          className="group/projectrow flex items-center gap-0.5 rounded-md transition-[filter] hover:brightness-125"
        >
          <Collapsible.Trigger
            aria-label={isOpen ? `Collapse ${project.name}` : `Expand ${project.name}`}
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground"
          >
            <ChevronDown
              className={cn(
                'size-3.5 transition-transform duration-200',
                !isOpen && '-rotate-90'
              )}
            />
          </Collapsible.Trigger>
          <button
            type="button"
            onClick={() => onSelectProject(project.id)}
            className="flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm min-w-0"
          >
            <span className="truncate flex-1 text-left">{project.name}</span>
            {projectTasks.length > 0 && (
              <span className="text-[10px] opacity-60 tabular-nums shrink-0">
                {projectTasks.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => onProjectSettings(project)}
            aria-label={`Settings for ${project.name}`}
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors mr-0.5"
          >
            <Settings className="size-3.5" />
          </button>
        </div>
        <Collapsible.Content className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
          <div className="flex flex-col gap-0.5 pl-5 pr-1 pt-0.5 pb-1">
            {projectTasks.length === 0 ? (
              <span className="text-xs italic text-muted-foreground/60 px-2 py-1">
                No active tasks
              </span>
            ) : (
              rootTasks.map((task) => renderTask(task, 0))
            )}
          </div>
        </Collapsible.Content>
      </Collapsible.Root>
    )
  }

  return (
    <div className="flex flex-col gap-1 px-2">
      {visibleProjects.map(renderProject)}
      {hiddenProjects.length > 0 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="group flex items-center gap-2 px-2 py-2 text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          <span className="flex-1 h-px bg-border/60 group-hover:bg-border transition-colors" />
          <span className="shrink-0">
            {showAll ? 'Hide inactive' : 'Show all projects'}
          </span>
          <span className="flex-1 h-px bg-border/60 group-hover:bg-border transition-colors" />
        </button>
      )}
    </div>
  )
}
