# Phase 2: Data Layer + Task CRUD - Research

**Researched:** 2026-01-17
**Domain:** React CRUD UI + IPC Extensions + Form Handling
**Confidence:** HIGH

## Summary

Phase 2 extends the Phase 1 foundation with update/delete IPC handlers and builds the first real UI components. The existing typed IPC layer (`window.api.db`) needs update/delete methods for tasks and projects. For state management, local component state with `useState` is appropriate since data operations go through Electron IPC (not REST APIs) - TanStack Query adds complexity without benefit here.

UI components use shadcn/ui forms with React Hook Form + Zod for validation. Inline editing follows click-to-edit pattern: display mode shows static text, edit mode swaps to input. shadcn components needed: Button, Input, Textarea, Select, Dialog, Calendar, Popover, Form.

**Primary recommendation:** Extend IPC layer with update/delete handlers, use local state for CRUD, shadcn Form components with react-hook-form + zod for validation.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-hook-form | ^7.x | Form state management | shadcn Form built on it, minimal re-renders |
| zod | ^3.x | Schema validation | TypeScript-first, infers types from schema |
| @hookform/resolvers | ^3.x | Zod-to-RHF bridge | Official integration |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | ^3.x | Date formatting | Due date display, date picker |
| react-day-picker | ^9.x | Calendar component | Required by shadcn Calendar |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-hook-form | Formik | Formik larger bundle, more boilerplate |
| zod | yup | yup less TypeScript-native |
| Local state | TanStack Query | Query designed for REST APIs, overkill for IPC |

**Installation:**
```bash
# Form validation
npm install react-hook-form zod @hookform/resolvers

# Date handling
npm install date-fns react-day-picker

# shadcn components
npx shadcn@latest add button input textarea select dialog calendar popover form
```

## Architecture Patterns

### IPC Layer Extension

Add update/delete handlers following existing patterns in `src/main/ipc/database.ts`.

```typescript
// src/shared/types/api.ts - Extended
export interface UpdateTaskInput {
  id: string
  title?: string
  description?: string | null
  status?: TaskStatus
  priority?: number
  dueDate?: string | null
  blockedReason?: string | null
}

export interface UpdateProjectInput {
  id: string
  name?: string
  color?: string
}

export interface ElectronAPI {
  db: {
    // Projects
    getProjects: () => Promise<Project[]>
    createProject: (data: CreateProjectInput) => Promise<Project>
    updateProject: (data: UpdateProjectInput) => Promise<Project>
    deleteProject: (id: string) => Promise<void>

    // Tasks
    getTasks: () => Promise<Task[]>
    getTasksByProject: (projectId: string) => Promise<Task[]>
    getTask: (id: string) => Promise<Task | null>
    createTask: (data: CreateTaskInput) => Promise<Task>
    updateTask: (data: UpdateTaskInput) => Promise<Task>
    deleteTask: (id: string) => Promise<void>
  }
}
```

### IPC Handler Pattern for Update/Delete

```typescript
// src/main/ipc/database.ts
ipcMain.handle('db:tasks:update', (_, data: UpdateTaskInput) => {
  const fields: string[] = []
  const values: unknown[] = []

  if (data.title !== undefined) {
    fields.push('title = ?')
    values.push(data.title)
  }
  if (data.description !== undefined) {
    fields.push('description = ?')
    values.push(data.description)
  }
  if (data.status !== undefined) {
    fields.push('status = ?')
    values.push(data.status)
  }
  if (data.priority !== undefined) {
    fields.push('priority = ?')
    values.push(data.priority)
  }
  if (data.dueDate !== undefined) {
    fields.push('due_date = ?')
    values.push(data.dueDate)
  }
  if (data.blockedReason !== undefined) {
    fields.push('blocked_reason = ?')
    values.push(data.blockedReason)
  }

  if (fields.length === 0) {
    return db.prepare('SELECT * FROM tasks WHERE id = ?').get(data.id)
  }

  fields.push("updated_at = datetime('now')")
  values.push(data.id)

  const stmt = db.prepare(`
    UPDATE tasks SET ${fields.join(', ')} WHERE id = ?
  `)
  stmt.run(...values)
  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(data.id)
})

ipcMain.handle('db:tasks:delete', (_, id: string) => {
  const stmt = db.prepare('DELETE FROM tasks WHERE id = ?')
  const result = stmt.run(id)
  return result.changes > 0
})
```

### State Management Pattern

Use local component state, not global state manager. Each view fetches its own data.

```typescript
// Pattern for task list view
function TaskList({ projectId }: { projectId: string }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  const loadTasks = async () => {
    setLoading(true)
    const data = await window.api.db.getTasksByProject(projectId)
    setTasks(data)
    setLoading(false)
  }

  useEffect(() => {
    loadTasks()
  }, [projectId])

  const handleDelete = async (id: string) => {
    await window.api.db.deleteTask(id)
    setTasks(tasks.filter(t => t.id !== id))
  }

  const handleUpdate = async (data: UpdateTaskInput) => {
    const updated = await window.api.db.updateTask(data)
    setTasks(tasks.map(t => t.id === updated.id ? updated : t))
  }

  // ...
}
```

### Inline Editing Pattern

Click-to-edit with blur/enter to save, escape to cancel.

```typescript
// Reusable inline edit component
interface InlineEditProps {
  value: string
  onSave: (value: string) => Promise<void>
  as?: 'input' | 'textarea'
}

function InlineEdit({ value, onSave, as = 'input' }: InlineEditProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const handleSave = async () => {
    if (draft !== value) {
      await onSave(draft)
    }
    setEditing(false)
  }

  const handleCancel = () => {
    setDraft(value)
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && as === 'input') {
      e.preventDefault()
      handleSave()
    }
    if (e.key === 'Escape') {
      handleCancel()
    }
  }

  if (!editing) {
    return (
      <span
        onClick={() => setEditing(true)}
        className="cursor-pointer hover:bg-muted px-1 -mx-1 rounded"
      >
        {value || <span className="text-muted-foreground">Click to edit</span>}
      </span>
    )
  }

  const Component = as === 'textarea' ? Textarea : Input
  return (
    <Component
      ref={inputRef as any}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={handleSave}
      onKeyDown={handleKeyDown}
    />
  )
}
```

### Form Validation with Zod + React Hook Form

```typescript
// src/renderer/src/lib/schemas.ts
import { z } from 'zod'

export const taskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(5000).optional(),
  status: z.enum(['inbox', 'backlog', 'todo', 'in_progress', 'review', 'done']),
  priority: z.number().min(1).max(5),
  dueDate: z.string().nullable().optional(),
  projectId: z.string().uuid(),
})

export const projectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid color format'),
})

export type TaskFormData = z.infer<typeof taskSchema>
export type ProjectFormData = z.infer<typeof projectSchema>
```

```typescript
// Task create modal using shadcn Form
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { taskSchema, TaskFormData } from '@/lib/schemas'

function CreateTaskDialog({ projectId, onCreated }: Props) {
  const form = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: '',
      description: '',
      status: 'inbox',
      priority: 3,
      dueDate: null,
      projectId,
    },
  })

  const onSubmit = async (data: TaskFormData) => {
    const task = await window.api.db.createTask({
      projectId: data.projectId,
      title: data.title,
      description: data.description,
      status: data.status,
      priority: data.priority,
      dueDate: data.dueDate ?? undefined,
    })
    onCreated(task)
    form.reset()
  }

  return (
    <Dialog>
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
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {/* More fields... */}
            <Button type="submit">Create</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
```

### Anti-Patterns to Avoid
- **Global state for server data**: Don't put tasks/projects in Redux/Zustand. Local state + IPC is simpler.
- **Manual refetch everywhere**: Update local state after mutations instead of re-fetching.
- **Uncontrolled forms for complex validation**: React Hook Form provides better UX.
- **Inline editing without draft state**: Always keep draft separate from source of truth.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Form validation | Manual onChange + state | zod + react-hook-form | Error states, async validation, field arrays |
| Date picker | Custom calendar | shadcn Calendar + Popover | Accessibility, keyboard nav, localization |
| Select dropdown | Native `<select>` | shadcn Select | Consistent styling, portal rendering |
| Modal dialogs | Custom overlay | shadcn Dialog | Focus trap, escape handling, a11y |
| Inline editing | Ad-hoc per field | Reusable InlineEdit component | Consistent behavior, keyboard handling |

**Key insight:** shadcn provides accessible, styled primitives. Form handling with react-hook-form prevents common validation bugs.

## Common Pitfalls

### Pitfall 1: Stale State After Mutation
**What goes wrong:** UI shows old data after create/update/delete
**Why it happens:** Forgot to update local state after IPC call
**How to avoid:** Always update local state after successful IPC:
```typescript
// After delete
setTasks(tasks.filter(t => t.id !== id))
// After update
setTasks(tasks.map(t => t.id === updated.id ? updated : t))
// After create
setTasks([...tasks, newTask])
```
**Warning signs:** Data appears after page refresh but not immediately

### Pitfall 2: Lost Edit on Blur
**What goes wrong:** User loses edits when clicking outside input
**Why it happens:** Blur handler saves empty/partial state
**How to avoid:** Keep draft state, only save if different from original:
```typescript
const handleBlur = async () => {
  if (draft.trim() && draft !== value) {
    await onSave(draft)
  }
  setEditing(false)
}
```
**Warning signs:** Accidental saves, empty values saved

### Pitfall 3: Form Default Values Not Updating
**What goes wrong:** Edit form shows stale data when switching between tasks
**Why it happens:** react-hook-form caches defaultValues
**How to avoid:** Use `reset()` when entity changes:
```typescript
useEffect(() => {
  form.reset({
    title: task.title,
    description: task.description ?? '',
    // ...
  })
}, [task.id])
```
**Warning signs:** Edit modal shows previous task's data

### Pitfall 4: Partial Update Overwrites Fields
**What goes wrong:** Updating title clears description
**Why it happens:** Update handler replaces all fields
**How to avoid:** Build SET clause dynamically from provided fields only
**Warning signs:** Fields become null after editing different field

### Pitfall 5: Date Timezone Issues
**What goes wrong:** Due date shifts by a day
**Why it happens:** JavaScript Date uses local timezone, SQLite stores UTC
**How to avoid:** Store dates as ISO strings (YYYY-MM-DD), avoid Date object conversion:
```typescript
// Store as string, compare as string
const isOverdue = task.due_date && task.due_date < new Date().toISOString().split('T')[0]
```
**Warning signs:** Due dates wrong by hours/days

## Code Examples

### shadcn Form Component Installation
```bash
npx shadcn@latest add form
# Installs: react-hook-form, @hookform/resolvers, zod (if not present)
```

### Complete Task Form with All Fields
```typescript
// src/renderer/src/components/TaskForm.tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { format } from 'date-fns'

const statuses = [
  { value: 'inbox', label: 'Inbox' },
  { value: 'backlog', label: 'Backlog' },
  { value: 'todo', label: 'Todo' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'done', label: 'Done' },
] as const

const priorities = [
  { value: 1, label: 'P1 - Urgent' },
  { value: 2, label: 'P2 - High' },
  { value: 3, label: 'P3 - Medium' },
  { value: 4, label: 'P4 - Low' },
  { value: 5, label: 'P5 - Someday' },
]

const schema = z.object({
  title: z.string().min(1, 'Required'),
  description: z.string().optional(),
  status: z.enum(['inbox', 'backlog', 'todo', 'in_progress', 'review', 'done']),
  priority: z.number().min(1).max(5),
  dueDate: z.date().nullable(),
})

type FormData = z.infer<typeof schema>

interface TaskFormProps {
  defaultValues?: Partial<FormData>
  onSubmit: (data: FormData) => Promise<void>
  submitLabel?: string
}

export function TaskForm({ defaultValues, onSubmit, submitLabel = 'Save' }: TaskFormProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      description: '',
      status: 'inbox',
      priority: 3,
      dueDate: null,
      ...defaultValues,
    },
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="Task title" {...field} />
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
                <Textarea placeholder="Optional description" {...field} />
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
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {statuses.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
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
                  onValueChange={(v) => field.onChange(parseInt(v, 10))}
                  defaultValue={String(field.value)}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {priorities.map((p) => (
                      <SelectItem key={p.value} value={String(p.value)}>
                        {p.label}
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
                    <Button variant="outline" className="w-full justify-start">
                      {field.value ? format(field.value, 'PPP') : 'Pick a date'}
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value ?? undefined}
                    onSelect={field.onChange}
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full">
          {submitLabel}
        </Button>
      </form>
    </Form>
  )
}
```

### Delete Confirmation Pattern
```typescript
// Using shadcn AlertDialog for delete confirmation
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

function DeleteTaskButton({ task, onDeleted }: { task: Task; onDeleted: () => void }) {
  const handleDelete = async () => {
    await window.api.db.deleteTask(task.id)
    onDeleted()
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">Delete</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete task?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete "{task.title}".
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Formik | react-hook-form | 2022 | Less re-renders, smaller bundle |
| yup | zod | 2023 | Native TypeScript inference |
| Redux for all state | TanStack Query for server, local for UI | 2024 | Clear separation of concerns |
| Custom form components | shadcn/ui Form primitives | 2024 | Accessible, composable |

**Deprecated/outdated:**
- Formik: Still works but react-hook-form preferred in new projects
- Class components: Hooks-based forms are standard
- Global stores for CRUD data: Use data-fetching libraries or local state

## Open Questions

1. **Optimistic updates**
   - What we know: Can update UI before IPC confirms
   - What's unclear: Whether to implement now or defer
   - Recommendation: Skip for MVP. IPC is fast enough locally. Add if UX feels sluggish.

2. **Form autosave for description**
   - What we know: Textarea loses data on accidental navigation
   - What's unclear: Debounce interval, dirty state handling
   - Recommendation: Start with explicit save button. Add autosave later if requested.

## Sources

### Primary (HIGH confidence)
- [shadcn/ui Form](https://ui.shadcn.com/docs/components/form) - form component setup
- [shadcn/ui Date Picker](https://ui.shadcn.com/docs/components/date-picker) - calendar integration
- [React Hook Form Docs](https://react-hook-form.com/docs/useform) - form API reference
- [Zod Documentation](https://zod.dev/) - schema validation
- [better-sqlite3 API](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md) - run() method

### Secondary (MEDIUM confidence)
- [React State Management 2025](https://www.developerway.com/posts/react-state-management-2025) - local vs global state
- [TanStack Query vs useState](https://refine.dev/blog/react-query-vs-tanstack-query-vs-swr-2025/) - when to use each
- [Inline Edit Patterns](https://blog.logrocket.com/build-inline-editable-ui-react/) - click-to-edit UX

### Tertiary (LOW confidence)
- WebSearch results on Electron IPC patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - shadcn explicitly uses react-hook-form + zod
- Architecture: HIGH - follows Phase 1 IPC patterns
- Pitfalls: MEDIUM - based on general React/form experience

**Research date:** 2026-01-17
**Valid until:** 2026-02-17 (stable patterns, 30 days)
