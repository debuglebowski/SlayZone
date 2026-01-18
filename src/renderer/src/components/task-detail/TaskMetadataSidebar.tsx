import { format } from 'date-fns'
import { CalendarIcon, AlertCircle, Repeat } from 'lucide-react'
import type { Task, Tag, TaskStatus, RecurrenceType } from '../../../../shared/types/database'
import { statusOptions, priorityOptions } from '@/lib/schemas'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { ProjectSelect } from '../ProjectSelect'

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
  const handleStatusChange = async (status: TaskStatus): Promise<void> => {
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

  const handleBlockedChange = async (blocked: boolean): Promise<void> => {
    const blockedReason = blocked ? 'Blocked' : null
    const updated = await window.api.db.updateTask({ id: task.id, blockedReason })
    onUpdate(updated)
  }

  const handleBlockedReasonChange = async (reason: string): Promise<void> => {
    const updated = await window.api.db.updateTask({
      id: task.id,
      blockedReason: reason || null
    })
    onUpdate(updated)
  }

  const handleTagToggle = async (tagId: string, checked: boolean): Promise<void> => {
    const newTagIds = checked ? [...taskTagIds, tagId] : taskTagIds.filter((id) => id !== tagId)
    await window.api.taskTags.setTagsForTask(task.id, newTagIds)
    onTagsChange(newTagIds)
  }

  const calculateNextReset = (type: RecurrenceType, interval: number): string => {
    const now = new Date()
    const next = new Date(now)

    if (type === 'daily') {
      next.setDate(next.getDate() + interval)
    } else if (type === 'weekly') {
      next.setDate(next.getDate() + interval * 7)
    } else if (type === 'monthly') {
      next.setMonth(next.getMonth() + interval)
    }

    return next.toISOString()
  }

  const handleRecurringChange = async (enabled: boolean): Promise<void> => {
    if (enabled) {
      // Enable with default values: daily, interval 1
      const nextReset = calculateNextReset('daily', 1)
      const updated = await window.api.db.updateTask({
        id: task.id,
        recurrenceType: 'daily',
        recurrenceInterval: 1,
        nextResetAt: nextReset
      })
      onUpdate(updated)
    } else {
      // Disable recurring
      const updated = await window.api.db.updateTask({
        id: task.id,
        recurrenceType: null,
        recurrenceInterval: null,
        nextResetAt: null
      })
      onUpdate(updated)
    }
  }

  const handleRecurrenceTypeChange = async (type: RecurrenceType): Promise<void> => {
    const interval = task.recurrence_interval ?? 1
    const nextReset = calculateNextReset(type, interval)
    const updated = await window.api.db.updateTask({
      id: task.id,
      recurrenceType: type,
      nextResetAt: nextReset
    })
    onUpdate(updated)
  }

  const handleRecurrenceIntervalChange = async (interval: number): Promise<void> => {
    if (interval < 1) return
    const type = task.recurrence_type ?? 'daily'
    const nextReset = calculateNextReset(type, interval)
    const updated = await window.api.db.updateTask({
      id: task.id,
      recurrenceInterval: interval,
      nextResetAt: nextReset
    })
    onUpdate(updated)
  }

  const selectedTags = tags.filter((t) => taskTagIds.includes(t.id))

  return (
    <div className="space-y-4">
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

      {/* Blocked */}
      <div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="blocked"
            checked={!!task.blocked_reason}
            onCheckedChange={handleBlockedChange}
          />
          <label
            htmlFor="blocked"
            className={cn(
              'flex cursor-pointer items-center gap-1 text-sm',
              task.blocked_reason && 'text-destructive'
            )}
          >
            <AlertCircle className="size-4" />
            Blocked
          </label>
        </div>
        {task.blocked_reason && (
          <Input
            value={task.blocked_reason}
            onChange={(e) => handleBlockedReasonChange(e.target.value)}
            onBlur={(e) => handleBlockedReasonChange(e.target.value)}
            className="mt-2 w-full"
            placeholder="Reason..."
          />
        )}
      </div>

      {/* Recurring */}
      <div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="recurring"
            checked={!!task.recurrence_type}
            onCheckedChange={handleRecurringChange}
          />
          <label
            htmlFor="recurring"
            className="flex cursor-pointer items-center gap-1 text-sm"
          >
            <Repeat className="size-4" />
            Recurring
          </label>
        </div>
        {task.recurrence_type && (
          <div className="mt-2 space-y-2">
            <Select
              value={task.recurrence_type}
              onValueChange={handleRecurrenceTypeChange}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Every</span>
              <Input
                type="number"
                min="1"
                value={task.recurrence_interval ?? 1}
                onChange={(e) => {
                  const value = parseInt(e.target.value, 10)
                  if (!isNaN(value) && value > 0) {
                    handleRecurrenceIntervalChange(value)
                  }
                }}
                className="w-16"
              />
              <span className="text-sm text-muted-foreground">
                {task.recurrence_type === 'daily'
                  ? 'day(s)'
                  : task.recurrence_type === 'weekly'
                    ? 'week(s)'
                    : 'month(s)'}
              </span>
            </div>
            {task.next_reset_at && (
              <p className="text-xs text-muted-foreground">
                Next reset: {format(new Date(task.next_reset_at), 'MMM d, yyyy')}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
