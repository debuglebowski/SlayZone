import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import type { Task, Tag } from '../../../shared/types/database'
import {
  createTaskSchema,
  type CreateTaskFormData,
  statusOptions,
  priorityOptions
} from '@/lib/schemas'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Checkbox } from '@/components/ui/checkbox'
import { ProjectSelect } from './ProjectSelect'
import { cn } from '@/lib/utils'

interface CreateTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (task: Task) => void
  defaultProjectId?: string
  tags: Tag[]
}

export function CreateTaskDialog({
  open,
  onOpenChange,
  onCreated,
  defaultProjectId,
  tags
}: CreateTaskDialogProps): React.JSX.Element {
  const form = useForm<CreateTaskFormData>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      projectId: defaultProjectId ?? '',
      title: '',
      description: '',
      status: 'inbox',
      priority: 3,
      dueDate: null,
      tagIds: []
    }
  })

  // Reset form when dialog opens with new defaultProjectId
  useEffect(() => {
    if (open) {
      form.reset({
        projectId: defaultProjectId ?? '',
        title: '',
        description: '',
        status: 'inbox',
        priority: 3,
        dueDate: null,
        tagIds: []
      })
    }
  }, [open, defaultProjectId, form])

  const onSubmit = async (data: CreateTaskFormData): Promise<void> => {
    const task = await window.api.db.createTask({
      projectId: data.projectId,
      title: data.title,
      description: data.description || undefined,
      status: data.status,
      priority: data.priority,
      dueDate: data.dueDate ?? undefined
    })
    if (data.tagIds.length > 0) {
      await window.api.taskTags.setTagsForTask(task.id, data.tagIds)
    }
    onCreated(task)
    form.reset()
  }

  // Get selected tags for display
  const selectedTagIds = form.watch('tagIds')
  const selectedTags = tags.filter((t) => selectedTagIds.includes(t.id))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input {...field} autoFocus placeholder="Task title" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Optional description" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {statusOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(Number(v))}
                      value={String(field.value)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {priorityOptions.map((opt) => (
                          <SelectItem key={opt.value} value={String(opt.value)}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Due Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-start text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="mr-2 size-4" />
                          {field.value ? format(new Date(field.value), 'PPP') : 'Pick a date'}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value ? new Date(field.value) : undefined}
                        onSelect={(date) =>
                          field.onChange(date ? format(date, 'yyyy-MM-dd') : null)
                        }
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tagIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant="outline" className="w-full justify-start">
                          {selectedTags.length === 0 ? (
                            <span className="text-muted-foreground">Select tags...</span>
                          ) : (
                            <div className="flex gap-1">
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
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[200px] p-2" align="start">
                      {tags.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No tags created</p>
                      ) : (
                        <div className="space-y-2">
                          {tags.map((tag) => (
                            <label
                              key={tag.id}
                              className="flex cursor-pointer items-center gap-2"
                            >
                              <Checkbox
                                checked={field.value.includes(tag.id)}
                                onCheckedChange={(checked) => {
                                  const newValue = checked
                                    ? [...field.value, tag.id]
                                    : field.value.filter((id: string) => id !== tag.id)
                                  field.onChange(newValue)
                                }}
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
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="projectId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project</FormLabel>
                  <FormControl>
                    <ProjectSelect value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Create</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
