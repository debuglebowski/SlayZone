import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { ArrowDownToLineIcon, ArrowUpToLineIcon, CalendarIcon, ChevronRight, EllipsisIcon, ExternalLinkIcon, RefreshCwIcon, UnlinkIcon, X } from 'lucide-react'
import type { Task } from '@slayzone/task/shared'
import { priorityOptions } from '@slayzone/task/shared'
import type { Project } from '@slayzone/projects/shared'
import { isTerminalStatus } from '@slayzone/projects/shared'
import type { Tag } from '@slayzone/tags/shared'
import type { ExternalLink, TaskSyncStatus } from '@slayzone/integrations/shared'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@slayzone/ui'
import { Popover, PopoverContent, PopoverTrigger } from '@slayzone/ui'
import { Calendar } from '@slayzone/ui'
import { Button, IconButton } from '@slayzone/ui'
import { Checkbox } from '@slayzone/ui'
import {
  buildStatusOptions,
  cn,
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@slayzone/ui'
import { ProjectSelect } from '@slayzone/projects'

interface TaskMetadataSidebarProps {
  task: Task
  tags: Tag[]
  taskTagIds: string[]
  onUpdate: (task: Task) => void
  onTagsChange: (tagIds: string[]) => void
}

export function TaskMetadataSidebar({
  task,
  tags,
  taskTagIds,
  onUpdate,
  onTagsChange
}: TaskMetadataSidebarProps): React.JSX.Element {
  const [allTasks, setAllTasks] = useState<Task[]>([])
  const [blockers, setBlockers] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])

  // Load all tasks and current blockers
  useEffect(() => {
    const loadData = async () => {
      const [tasks, currentBlockers, allProjects] = await Promise.all([
        window.api.db.getTasks(),
        window.api.taskDependencies.getBlockers(task.id),
        window.api.db.getProjects()
      ])
      setAllTasks(tasks.filter((t) => t.id !== task.id))
      setBlockers(currentBlockers)
      setProjects(allProjects)
    }
    loadData()
  }, [task.id])

  const handleAddBlocker = async (blockerTaskId: string): Promise<void> => {
    await window.api.taskDependencies.addBlocker(task.id, blockerTaskId)
    const blockerTask = allTasks.find((t) => t.id === blockerTaskId)
    if (blockerTask) {
      setBlockers([...blockers, blockerTask])
    }
  }

  const handleRemoveBlocker = async (blockerTaskId: string): Promise<void> => {
    await window.api.taskDependencies.removeBlocker(task.id, blockerTaskId)
    setBlockers(blockers.filter((b) => b.id !== blockerTaskId))
  }

  const columnsByProject = new Map(projects.map((project) => [project.id, project.columns_config]))
  const availableBlockers = allTasks.filter((t) => (
    !blockers.some((b) => b.id === t.id) && !isTerminalStatus(t.status, columnsByProject.get(t.project_id))
  ))
  const selectedProject = projects.find((project) => project.id === task.project_id)
  const statusOptions = buildStatusOptions(selectedProject?.columns_config)

  const handleStatusChange = async (status: string): Promise<void> => {
    const updated = await window.api.db.updateTask({ id: task.id, status })
    onUpdate(updated)
  }

  const handleProjectChange = async (projectId: string): Promise<void> => {
    const updated = await window.api.db.updateTask({ id: task.id, projectId })
    onUpdate(updated)
  }

  const handlePriorityChange = async (priority: number): Promise<void> => {
    const updated = await window.api.db.updateTask({ id: task.id, priority })
    onUpdate(updated)
  }

  const handleDueDateChange = async (date: Date | undefined): Promise<void> => {
    const dueDate = date ? format(date, 'yyyy-MM-dd') : undefined
    const updated = await window.api.db.updateTask({ id: task.id, dueDate })
    onUpdate(updated)
  }

  const handleTagToggle = async (tagId: string, checked: boolean): Promise<void> => {
    const newTagIds = checked ? [...taskTagIds, tagId] : taskTagIds.filter((id) => id !== tagId)
    await window.api.taskTags.setTagsForTask(task.id, newTagIds)
    onTagsChange(newTagIds)
  }

  const selectedTags = tags.filter((t) => taskTagIds.includes(t.id))

  return (
    <div className="space-y-2">
      {/* Project */}
      <div>
        <label className="mb-1 block text-sm text-muted-foreground">Project</label>
        <ProjectSelect value={task.project_id} onChange={handleProjectChange} />
      </div>

      {/* Status */}
      <div>
        <label className="mb-1 block text-sm text-muted-foreground">Status</label>
        <Select value={task.status} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Priority */}
      <div>
        <label className="mb-1 block text-sm text-muted-foreground">Priority</label>
        <Select
          value={String(task.priority)}
          onValueChange={(v) => handlePriorityChange(Number(v))}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {priorityOptions.map((opt) => (
              <SelectItem key={opt.value} value={String(opt.value)}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Due Date */}
      <div>
        <label className="mb-1 block text-sm text-muted-foreground">Due Date</label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-full justify-start text-left font-normal',
                !task.due_date && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 size-4" />
              {task.due_date ? format(new Date(task.due_date), 'MMM d, yyyy') : 'No date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={task.due_date ? new Date(task.due_date) : undefined}
              onSelect={handleDueDateChange}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Tags */}
      <div>
        <label className="mb-1 block text-sm text-muted-foreground">Tags</label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-start">
              {selectedTags.length === 0 ? (
                <span className="text-muted-foreground">None</span>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {selectedTags.slice(0, 3).map((tag) => (
                    <span
                      key={tag.id}
                      className="rounded px-1.5 py-0.5 text-xs"
                      style={{ backgroundColor: tag.color + '30', color: tag.color }}
                    >
                      {tag.name}
                    </span>
                  ))}
                  {selectedTags.length > 3 && (
                    <span className="text-xs text-muted-foreground">
                      +{selectedTags.length - 3}
                    </span>
                  )}
                </div>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-2">
            {tags.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tags created</p>
            ) : (
              <div className="space-y-2">
                {tags.map((tag) => (
                  <label key={tag.id} className="flex cursor-pointer items-center gap-2">
                    <Checkbox
                      checked={taskTagIds.includes(tag.id)}
                      onCheckedChange={(checked) => handleTagToggle(tag.id, checked === true)}
                    />
                    <span
                      className="rounded px-1.5 py-0.5 text-sm"
                      style={{ backgroundColor: tag.color + '30', color: tag.color }}
                    >
                      {tag.name}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {/* Blocked By */}
      <div>
        <label className="mb-1 block text-sm text-muted-foreground">Blocked By</label>
        {blockers.length > 0 && (
          <div className="mb-2 space-y-1">
            {blockers.map((blocker) => (
              <div
                key={blocker.id}
                className="flex items-center gap-2 rounded bg-muted/50 px-2 py-1 text-sm"
              >
                <span className="flex-1 truncate">{blocker.title}</span>
                <button
                  onClick={() => handleRemoveBlocker(blocker.id)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="w-full">
              Add blocker
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[250px] p-2" align="start">
            {availableBlockers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tasks available</p>
            ) : (
              <div className="max-h-[200px] space-y-1 overflow-y-auto">
                {availableBlockers.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleAddBlocker(t.id)}
                    className="w-full rounded px-2 py-1 text-left text-sm hover:bg-muted"
                  >
                    <span className="line-clamp-1">{t.title}</span>
                  </button>
                ))}
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

    </div>
  )
}

// ---------------------------------------------------------------------------
// External Sync Card (provider-aware scaffold)
// ---------------------------------------------------------------------------

interface ExternalSyncCardProps {
  taskId: string
  onUpdate: (task: Task) => void
}

const PROVIDER_LABELS: Record<ExternalLink['provider'], string> = {
  linear: 'Linear',
  github: 'GitHub'
}

const SYNC_STATE_META: Record<TaskSyncStatus['state'], { label: string; className: string }> = {
  in_sync: {
    label: 'In sync',
    className: 'bg-emerald-500/15 text-emerald-300'
  },
  local_ahead: {
    label: 'Local ahead',
    className: 'bg-blue-500/15 text-blue-300'
  },
  remote_ahead: {
    label: 'Remote ahead',
    className: 'bg-amber-500/15 text-amber-300'
  },
  conflict: {
    label: 'Conflict',
    className: 'bg-red-500/15 text-red-300'
  },
  unknown: {
    label: 'Unknown',
    className: 'bg-muted text-muted-foreground'
  }
}

function formatFieldName(field: TaskSyncStatus['fields'][number]['field']): string {
  if (field === 'description') return 'Description'
  if (field === 'status') return 'Status'
  return 'Title'
}

export function ExternalSyncCard({ taskId, onUpdate }: ExternalSyncCardProps) {
  const [links, setLinks] = useState<ExternalLink[]>([])
  const [githubSyncByLinkId, setGithubSyncByLinkId] = useState<Record<string, TaskSyncStatus>>({})
  const [syncMessage, setSyncMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      window.api.integrations.getLink(taskId, 'linear'),
      window.api.integrations.getLink(taskId, 'github')
    ]).then(async ([linearLink, githubLink]) => {
      const loadedLinks = [linearLink, githubLink].filter((link): link is ExternalLink => Boolean(link))
      if (cancelled) return
      setLinks(loadedLinks)

      const githubExternalLink = loadedLinks.find((link) => link.provider === 'github')
      if (!githubExternalLink) {
        setGithubSyncByLinkId({})
        return
      }

      try {
        const syncStatus = await window.api.integrations.getTaskSyncStatus(taskId, 'github')
        if (cancelled) return
        setGithubSyncByLinkId({ [githubExternalLink.id]: syncStatus })
      } catch {
        if (cancelled) return
        setGithubSyncByLinkId({})
      }
    })
    return () => {
      cancelled = true
    }
  }, [taskId])

  const handleSync = async (link: ExternalLink) => {
    try {
      if (link.provider !== 'linear') {
        const status = await window.api.integrations.getTaskSyncStatus(taskId, 'github')
        setGithubSyncByLinkId((current) => ({ ...current, [link.id]: status }))
        const changed = status.fields.filter((field) => field.state !== 'in_sync')
        const summary = changed.length > 0
          ? changed.map((field) => `${formatFieldName(field.field)} ${field.state.replace('_', ' ')}`).join(', ')
          : 'No changes'
        setSyncMessage(`GitHub diff: ${SYNC_STATE_META[status.state].label}${summary ? ` (${summary})` : ''}`)
        return
      }
      const result = await window.api.integrations.syncNow({ taskId })
      const errSuffix = result.errors.length > 0 ? ` (${result.errors.length} errors)` : ''
      setSyncMessage(`${PROVIDER_LABELS[link.provider]} synced: ${result.pulled} pulled, ${result.pushed} pushed${errSuffix}`)
      const refreshedTask = await window.api.db.getTask(taskId)
      if (refreshedTask) onUpdate(refreshedTask)
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : String(error))
    }
  }

  const handlePush = async (link: ExternalLink, force = false) => {
    try {
      if (link.provider !== 'github') return
      const result = await window.api.integrations.pushTask({
        taskId,
        provider: 'github',
        force
      })
      setGithubSyncByLinkId((current) => ({ ...current, [link.id]: result.status }))
      setSyncMessage(result.message ?? (result.pushed ? 'Pushed local changes to GitHub' : 'No push performed'))
      if (result.pushed) {
        const refreshedTask = await window.api.db.getTask(taskId)
        if (refreshedTask) onUpdate(refreshedTask)
      }
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : String(error))
    }
  }

  const handlePull = async (link: ExternalLink, force = false) => {
    try {
      if (link.provider !== 'github') return
      const result = await window.api.integrations.pullTask({
        taskId,
        provider: 'github',
        force
      })
      setGithubSyncByLinkId((current) => ({ ...current, [link.id]: result.status }))
      setSyncMessage(result.message ?? (result.pulled ? 'Pulled remote changes from GitHub' : 'No pull performed'))
      if (result.pulled) {
        const refreshedTask = await window.api.db.getTask(taskId)
        if (refreshedTask) onUpdate(refreshedTask)
      }
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : String(error))
    }
  }

  const handleUnlink = async (link: ExternalLink) => {
    await window.api.integrations.unlinkTask(taskId, link.provider)
    setLinks((current) => current.filter((item) => item.id !== link.id))
    setGithubSyncByLinkId((current) => {
      if (!(link.id in current)) return current
      const copy = { ...current }
      delete copy[link.id]
      return copy
    })
    setSyncMessage(`Unlinked from ${PROVIDER_LABELS[link.provider]}`)
  }

  if (links.length === 0) return null

  return (
    <Collapsible>
      <CollapsibleTrigger className="flex w-full items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors [&[data-state=open]>svg]:rotate-90">
        <ChevronRight className="size-3 transition-transform" />
        External sync
      </CollapsibleTrigger>
      <CollapsibleContent className="border-l border-border ml-2 pl-6 pt-5">
        <div className="space-y-2">
          {links.map((link) => (
            <div key={link.id} className="space-y-1.5">
              <div className="flex items-center gap-1">
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {PROVIDER_LABELS[link.provider]}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">{link.external_key}</span>
                {link.provider === 'github' && githubSyncByLinkId[link.id] ? (
                  <span
                    className={cn(
                      'shrink-0 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide',
                      SYNC_STATE_META[githubSyncByLinkId[link.id].state].className
                    )}
                  >
                    {SYNC_STATE_META[githubSyncByLinkId[link.id].state].label}
                  </span>
                ) : null}
                <IconButton
                  variant="ghost"
                  aria-label={`Open in ${PROVIDER_LABELS[link.provider]}`}
                  className="size-7"
                  onClick={() => window.api.shell.openExternal(link.external_url)}
                  title={`Open in ${PROVIDER_LABELS[link.provider]}`}
                >
                  <ExternalLinkIcon className="size-3.5" />
                </IconButton>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <IconButton variant="ghost" aria-label={`${PROVIDER_LABELS[link.provider]} actions`} className="size-7">
                      <EllipsisIcon className="size-3.5" />
                    </IconButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {link.provider === 'linear' ? (
                      <DropdownMenuItem onClick={() => void handleSync(link)}>
                        <RefreshCwIcon className="size-3.5" />
                        Sync
                      </DropdownMenuItem>
                    ) : (
                      <>
                        <DropdownMenuItem onClick={() => void handleSync(link)}>
                          <RefreshCwIcon className="size-3.5" />
                          Check diff
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => void handlePush(link)}
                          disabled={githubSyncByLinkId[link.id]?.state === 'in_sync'}
                        >
                          <ArrowUpToLineIcon className="size-3.5" />
                          Push local changes
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => void handlePull(link)}
                          disabled={
                            githubSyncByLinkId[link.id]?.state === 'in_sync' ||
                            githubSyncByLinkId[link.id]?.state === 'local_ahead' ||
                            githubSyncByLinkId[link.id]?.state === 'conflict'
                          }
                        >
                          <ArrowDownToLineIcon className="size-3.5" />
                          Pull remote changes
                        </DropdownMenuItem>
                        {githubSyncByLinkId[link.id] &&
                        (githubSyncByLinkId[link.id].state === 'remote_ahead' ||
                          githubSyncByLinkId[link.id].state === 'conflict') ? (
                          <DropdownMenuItem onClick={() => void handlePush(link, true)}>
                            <ArrowUpToLineIcon className="size-3.5" />
                            Force push
                          </DropdownMenuItem>
                        ) : null}
                        {githubSyncByLinkId[link.id] &&
                        (githubSyncByLinkId[link.id].state === 'local_ahead' ||
                          githubSyncByLinkId[link.id].state === 'conflict') ? (
                          <DropdownMenuItem onClick={() => void handlePull(link, true)}>
                            <ArrowDownToLineIcon className="size-3.5" />
                            Force pull
                          </DropdownMenuItem>
                        ) : null}
                      </>
                    )}
                    <DropdownMenuItem onClick={() => void handleUnlink(link)}>
                      <UnlinkIcon className="size-3.5" />
                      Unlink
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {link.provider === 'github' && githubSyncByLinkId[link.id] ? (
                <p className="text-[11px] text-muted-foreground">
                  {githubSyncByLinkId[link.id].fields
                    .filter((field) => field.state !== 'in_sync')
                    .map((field) => `${formatFieldName(field.field)}: ${field.state.replace('_', ' ')}`)
                    .join(' • ') || 'No field differences'}
                </p>
              ) : null}
            </div>
          ))}
          {syncMessage ? <p className="text-xs text-muted-foreground">{syncMessage}</p> : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function LinearCard(props: ExternalSyncCardProps) {
  return <ExternalSyncCard {...props} />
}
