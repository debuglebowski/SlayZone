import { useMemo, useState, type ReactNode } from 'react'
import { ChevronDown, Settings } from 'lucide-react'
import * as Collapsible from '@radix-ui/react-collapsible'
import { cn } from '@slayzone/ui'
import { type Task } from '@slayzone/task/shared'
import { useTabStore } from '@slayzone/settings'
import { useIdleTasks, useActiveSessionTaskIds } from '@/components/agent-status/useIdleTasks'
import type { SidebarViewContext } from './types'

// Tree guide layout (mirrors EditorToc / ManagerSidebar).
const TG_INDENT = 18
const TG_ROW_HEIGHT = 28
const TG_CURVE_R = 5
const TG_ELBOW_END_OFFSET = 7
const TG_ROOT_X = 15
const TG_TEXT_GAP_AFTER_CURVE = 8
const tgGuideX = (ancestorDepth: number) => TG_ROOT_X + TG_INDENT * ancestorDepth
const tgPaddingLeft = (depth: number) =>
  depth === 0 ? TG_ROOT_X : tgGuideX(depth - 1) + TG_ELBOW_END_OFFSET + TG_TEXT_GAP_AFTER_CURVE

function TreeGuides({ depth, ancestorFlags }: { depth: number; ancestorFlags: boolean[] }): ReactNode {
  if (depth <= 0) return null
  const parentX = tgGuideX(depth - 1)
  const mid = TG_ROW_HEIGHT / 2
  const r = TG_CURVE_R
  const endX = parentX + TG_ELBOW_END_OFFSET
  const continueBelow = ancestorFlags[depth - 1] ?? false
  const connector =
    `M ${parentX} 0 V ${mid - r} Q ${parentX} ${mid} ${parentX + r} ${mid} H ${endX}` +
    (continueBelow ? ` M ${parentX} ${mid - r} V ${TG_ROW_HEIGHT}` : '')
  const svgWidth = endX + 2
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute top-0 left-0 text-border"
      width={svgWidth}
      height={TG_ROW_HEIGHT}
    >
      {ancestorFlags.slice(0, -1).map((flag, a) =>
        flag ? (
          <line
            key={a}
            x1={tgGuideX(a)}
            x2={tgGuideX(a)}
            y1={0}
            y2={TG_ROW_HEIGHT}
            stroke="currentColor"
            strokeWidth={1}
          />
        ) : null
      )}
      <path d={connector} fill="none" stroke="currentColor" strokeWidth={1} />
    </svg>
  )
}

export function TreeView({
  projects,
  tasks,
  selectedProjectId,
  onSelectProject,
  onProjectSettings,
  onTaskClick,
  taskContextMenuRender,
}: SidebarViewContext) {
  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [projects]
  )

  const treeStatusFilter = useTabStore((s) => s.treeStatusFilter)
  const statusFilter = useMemo(() => new Set(treeStatusFilter), [treeStatusFilter])

  const tasksByProject = useMemo(() => {
    const m = new Map<string, Task[]>()
    for (const t of tasks) {
      if (!statusFilter.has(t.status)) continue
      const arr = m.get(t.project_id) ?? []
      arr.push(t)
      m.set(t.project_id, arr)
    }
    return m
  }, [tasks, statusFilter])

  // For each in-progress task id → its in-progress children. Subtasks whose parent
  // is not in-progress are promoted to the project root.
  const childrenByParent = useMemo(() => {
    const inProgressIds = new Set<string>()
    for (const t of tasks) if (statusFilter.has(t.status)) inProgressIds.add(t.id)
    const m = new Map<string, Task[]>()
    for (const t of tasks) {
      if (!statusFilter.has(t.status)) continue
      const pid = t.parent_id
      if (pid && inProgressIds.has(pid)) {
        const arr = m.get(pid) ?? []
        arr.push(t)
        m.set(pid, arr)
      }
    }
    return m
  }, [tasks, statusFilter])

  const rootTasksByProject = useMemo(() => {
    const inProgressIds = new Set<string>()
    for (const t of tasks) if (statusFilter.has(t.status)) inProgressIds.add(t.id)
    const m = new Map<string, Task[]>()
    for (const t of tasks) {
      if (!statusFilter.has(t.status)) continue
      const isOrphan = !t.parent_id || !inProgressIds.has(t.parent_id)
      if (!isOrphan) continue
      const arr = m.get(t.project_id) ?? []
      arr.push(t)
      m.set(t.project_id, arr)
    }
    return m
  }, [tasks, statusFilter])

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

  const renderTask = (task: Task, depth: number, ancestorFlags: boolean[]): ReactNode => {
    const isActive = activeTaskId === task.id
    const isIdle = idleByTask.has(task.id)
    const children = childrenByParent.get(task.id) ?? []
    const button = (
      <button
        type="button"
        onClick={() => onTaskClick?.(task.id)}
        style={{ paddingLeft: tgPaddingLeft(depth), minHeight: TG_ROW_HEIGHT }}
        className={cn(
          'relative flex w-full items-center gap-2 rounded-md pr-2 py-1 text-sm text-left transition-colors',
          isActive
            ? 'bg-white/10 text-foreground'
            : 'text-muted-foreground hover:bg-accent/40 hover:text-accent-foreground'
        )}
      >
        <TreeGuides depth={depth} ancestorFlags={ancestorFlags} />
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
    )
    return (
      <div key={task.id}>
        {taskContextMenuRender ? taskContextMenuRender(task, button) : button}
        {children.map((c, i) => renderTask(c, depth + 1, [...ancestorFlags, i < children.length - 1]))}
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
          className="group/projectrow relative flex items-center gap-0.5 rounded-md transition-[filter] hover:brightness-125"
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
          <div className="flex flex-col pr-1 pb-1">
            {projectTasks.length === 0 ? (
              <span className="text-xs italic text-muted-foreground/60 px-2 py-1">
                No active tasks
              </span>
            ) : (
              rootTasks.map((task, i) => renderTask(task, 1, [i < rootTasks.length - 1]))
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
