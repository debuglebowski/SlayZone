import { format } from 'date-fns'
import { CalendarIcon, AlertCircle } from 'lucide-react'
import type { Task, Tag, TaskStatus } from '../../../../shared/types/database'
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

interface TaskMetadataRowProps {
  task: Task
  tags: Tag[]
  taskTagIds: string[]
  onUpdate: (task: Task) => void
  onTagsChange: (tagIds: string[]) => void
}

export function TaskMetadataRow({
  task,
  tags,
  taskTagIds,
  onUpdate,
  onTagsChange
}: TaskMetadataRowProps): React.JSX.Element {
  const handleStatusChange = async (status: TaskStatus): Promise<void> => {
    const updated = await window.api.db.updateTask({ id: task.id, status })
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

  const selectedTags = tags.filter((t) => taskTagIds.includes(t.id))

  return (
    <div className="flex flex-wrap items-center gap-4 border-b pb-4">
      {/* Status */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Status</span>
        <Select value={task.status} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-[130px]">
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
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Priority</span>
        <Select
          value={String(task.priority)}
          onValueChange={(v) => handlePriorityChange(Number(v))}
        >
          <SelectTrigger className="w-[130px]">
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
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Due</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-[150px] justify-start text-left font-normal',
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
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Tags</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="min-w-[100px]">
              {selectedTags.length === 0 ? (
                <span className="text-muted-foreground">None</span>
              ) : (
                <div className="flex gap-1">
                  {selectedTags.slice(0, 2).map((tag) => (
                    <span
                      key={tag.id}
                      className="rounded px-1.5 py-0.5 text-xs"
                      style={{ backgroundColor: tag.color + '30', color: tag.color }}
                    >
                      {tag.name}
                    </span>
                  ))}
                  {selectedTags.length > 2 && (
                    <span className="text-xs text-muted-foreground">
                      +{selectedTags.length - 2}
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
        {task.blocked_reason && (
          <Input
            value={task.blocked_reason}
            onChange={(e) => handleBlockedReasonChange(e.target.value)}
            onBlur={(e) => handleBlockedReasonChange(e.target.value)}
            className="w-[200px]"
            placeholder="Reason..."
          />
        )}
      </div>
    </div>
  )
}
