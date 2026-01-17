# Phase 4: Task Management - Research

**Researched:** 2026-01-17
**Domain:** React DnD (kanban), markdown editing, state-based navigation, filter persistence
**Confidence:** HIGH

## Summary

Phase 4 implements kanban board with drag-drop, filtering, grouping, task detail page, and subtasks. The recommended stack is @dnd-kit for drag-drop (actively maintained, TypeScript-first, ~10KB), react-markdown for rendering with @uiw/react-md-editor for editing, and state-based navigation (no router needed for Electron). Filter state persists to SQLite settings table (already exists) per project. Subtasks use existing `parent_id` column - no schema changes needed.

**Primary recommendation:** Use @dnd-kit/core + @dnd-kit/sortable for kanban. Persist filter state via SQLite settings as JSON per project. Task detail page via conditional rendering (no router). Click-to-edit markdown with react-markdown render / textarea edit toggle.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @dnd-kit/core | ^6.x | Drag-drop context | Actively maintained, 5M+ weekly downloads, TypeScript-first |
| @dnd-kit/sortable | ^8.x | Sortable lists | Required for kanban columns, handles reordering |
| @dnd-kit/utilities | ^3.x | CSS transforms | CSS.Transform helper for smooth animations |
| react-markdown | ^9.x | Markdown render | 116K+ users, safe (no dangerouslySetInnerHTML), CommonMark compliant |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @uiw/react-md-editor | ^4.x | Markdown editor | Task description editing (optional - can use plain textarea) |
| remark-gfm | ^4.x | GitHub Flavored Markdown | Tables, strikethrough, task lists in descriptions |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @dnd-kit | react-beautiful-dnd | Deprecated by Atlassian, no longer maintained |
| @dnd-kit | hello-pangea/dnd | Fork of RBD, simpler but less flexible |
| @dnd-kit | pragmatic-drag-and-drop | Atlassian's new lib, headless but less mature |
| react-markdown | MDXEditor | 851KB vs ~10KB, overkill for task descriptions |
| @uiw/react-md-editor | Plain textarea | Simpler, no syntax highlighting |

**Installation:**
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities react-markdown remark-gfm
```

## Architecture Patterns

### Recommended Component Structure
```
src/renderer/src/
├── components/
│   ├── kanban/
│   │   ├── KanbanBoard.tsx      # DndContext + columns
│   │   ├── KanbanColumn.tsx     # Droppable column container
│   │   ├── KanbanCard.tsx       # Draggable task card
│   │   └── DragOverlay.tsx      # Visual feedback during drag
│   ├── filters/
│   │   ├── FilterPopover.tsx    # Filter controls
│   │   ├── GroupByPopover.tsx   # Group by selector
│   │   └── types.ts             # Filter state types
│   ├── task-detail/
│   │   ├── TaskDetailPage.tsx   # Full task view
│   │   ├── TaskMetadataRow.tsx  # Inline-editable metadata
│   │   ├── MarkdownEditor.tsx   # Click-to-edit description
│   │   └── SubtaskAccordion.tsx # Subtask list
│   └── ui/
│       └── ... (shadcn components)
├── hooks/
│   ├── useKanbanDnd.ts          # DnD logic extracted
│   └── useFilterState.ts        # Filter persistence
└── App.tsx                       # Navigation state
```

### Pattern 1: State-Based Navigation (No Router)

**What:** Task detail as conditional render, not route
**When to use:** Electron apps where URL routing adds complexity
**Why:** Electron uses file:// protocol, HashRouter works but conditional render is simpler

```tsx
// App.tsx
type ViewState =
  | { type: 'kanban' }
  | { type: 'task-detail'; taskId: string }

function App() {
  const [view, setView] = useState<ViewState>({ type: 'kanban' })

  const openTaskDetail = (taskId: string) =>
    setView({ type: 'task-detail', taskId })
  const closeTaskDetail = () =>
    setView({ type: 'kanban' })

  if (view.type === 'task-detail') {
    return (
      <TaskDetailPage
        taskId={view.taskId}
        onBack={closeTaskDetail}
      />
    )
  }

  return (
    <SidebarProvider>
      <AppSidebar ... />
      <SidebarInset>
        <KanbanBoard onTaskClick={openTaskDetail} />
      </SidebarInset>
    </SidebarProvider>
  )
}
```

### Pattern 2: Kanban with dnd-kit

**What:** Multiple sortable columns with cross-column drag
**When to use:** Status/priority/due date grouped task boards

```tsx
// Source: dnd-kit docs + community patterns
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove
} from '@dnd-kit/sortable'

interface KanbanBoardProps {
  tasks: Task[]
  groupBy: 'status' | 'priority' | 'due_date'
  onTaskMove: (taskId: string, newValue: string) => Promise<void>
}

function KanbanBoard({ tasks, groupBy, onTaskMove }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  )

  const columns = groupTasksBy(tasks, groupBy)

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const taskId = active.id as string
    const targetColumnId = over.id as string

    // over.id is the column ID (status/priority value)
    await onTaskMove(taskId, targetColumnId)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto p-4">
        {columns.map(column => (
          <KanbanColumn
            key={column.id}
            column={column}
            tasks={column.tasks}
          />
        ))}
      </div>

      <DragOverlay>
        {activeId && <KanbanCard task={findTask(activeId)} isDragging />}
      </DragOverlay>
    </DndContext>
  )
}
```

### Pattern 3: Sortable Column with Drop Zone

**What:** Column that accepts dropped tasks
**When to use:** Each kanban column

```tsx
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'

function KanbanColumn({ column, tasks }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })
  const taskIds = tasks.map(t => t.id)

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "w-72 flex-shrink-0 rounded-lg bg-muted/50 p-2",
        isOver && "ring-2 ring-primary"
      )}
    >
      <h3 className="px-2 py-1 font-semibold">
        {column.title} ({tasks.length})
      </h3>

      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 min-h-[100px]">
          {tasks.map(task => (
            <KanbanCard key={task.id} task={task} />
          ))}
        </div>
      </SortableContext>
    </div>
  )
}
```

### Pattern 4: Draggable Card

**What:** Task card that can be dragged between columns
**When to use:** Individual task representation

```tsx
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

function KanbanCard({ task, isDragging }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSorting
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSorting ? 0.5 : 1
  }

  const isOverdue = task.due_date && task.due_date < todayISO()
  const isBlocked = !!task.blocked_reason

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "rounded-md border bg-card p-3 cursor-grab shadow-sm",
        isDragging && "shadow-lg ring-2 ring-primary",
        isBlocked && "opacity-60 bg-muted"
      )}
    >
      <p className="font-medium line-clamp-2">{task.title}</p>
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        {/* Project color dot (in "All" view) */}
        {isOverdue && <span className="text-destructive">Overdue</span>}
        {isBlocked && <span>Blocked</span>}
      </div>
    </div>
  )
}
```

### Pattern 5: Filter State Persistence (SQLite)

**What:** Store filter/groupBy state per project in SQLite settings
**When to use:** FILT-06 requirement

```tsx
// Filter state type
interface FilterState {
  groupBy: 'status' | 'priority' | 'due_date'
  priority: number | null          // null = all
  dueDateRange: 'all' | 'overdue' | 'today' | 'week' | 'later'
  tags: string[]                   // tag IDs
  showBlocked: boolean
  showDone: boolean
}

// Persist via settings API (JSON stringified)
// Key format: filter:${projectId} or filter:all for All view

async function loadFilterState(projectId: string | null): Promise<FilterState> {
  const key = projectId ? `filter:${projectId}` : 'filter:all'
  const stored = await window.api.settings.get(key)
  if (stored) {
    return JSON.parse(stored)
  }
  return defaultFilterState
}

async function saveFilterState(
  projectId: string | null,
  state: FilterState
): Promise<void> {
  const key = projectId ? `filter:${projectId}` : 'filter:all'
  await window.api.settings.set(key, JSON.stringify(state))
}

// Custom hook
function useFilterState(projectId: string | null) {
  const [filter, setFilter] = useState<FilterState>(defaultFilterState)
  const [loaded, setLoaded] = useState(false)

  // Load on project change
  useEffect(() => {
    loadFilterState(projectId).then(state => {
      setFilter(state)
      setLoaded(true)
    })
  }, [projectId])

  // Save on filter change (debounced)
  useEffect(() => {
    if (!loaded) return
    const timeout = setTimeout(() => {
      saveFilterState(projectId, filter)
    }, 500)
    return () => clearTimeout(timeout)
  }, [filter, projectId, loaded])

  return [filter, setFilter] as const
}
```

### Pattern 6: Click-to-Edit Markdown

**What:** Show rendered markdown, click to edit in textarea
**When to use:** Task description field

```tsx
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  onSave: () => Promise<void>
}

function MarkdownEditor({ value, onChange, onSave }: MarkdownEditorProps) {
  const [editing, setEditing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus()
      // Move cursor to end
      textareaRef.current.selectionStart = value.length
    }
  }, [editing])

  const handleBlur = async () => {
    await onSave()
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setEditing(false)
    }
    // Cmd/Ctrl+Enter to save
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleBlur()
    }
  }

  if (editing) {
    return (
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="min-h-[200px] font-mono text-sm"
        placeholder="Add description (Markdown supported)"
      />
    )
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className="cursor-text rounded-md border p-4 min-h-[100px] prose prose-sm dark:prose-invert"
    >
      {value ? (
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {value}
        </ReactMarkdown>
      ) : (
        <p className="text-muted-foreground">Click to add description...</p>
      )}
    </div>
  )
}
```

### Pattern 7: GroupBy Logic

**What:** Transform flat task list into grouped columns
**When to use:** Kanban column generation

```tsx
type GroupKey = 'status' | 'priority' | 'due_date'

interface Column {
  id: string
  title: string
  tasks: Task[]
}

const STATUS_ORDER: TaskStatus[] = ['inbox', 'backlog', 'todo', 'in_progress', 'review', 'done']
const PRIORITY_ORDER = [1, 2, 3, 4, 5]
const DUE_DATE_BUCKETS = ['overdue', 'today', 'week', 'later', 'none'] as const

function groupTasksBy(tasks: Task[], groupBy: GroupKey): Column[] {
  switch (groupBy) {
    case 'status':
      return STATUS_ORDER.map(status => ({
        id: status,
        title: statusLabels[status],
        tasks: tasks.filter(t => t.status === status)
      }))

    case 'priority':
      return PRIORITY_ORDER.map(p => ({
        id: `p${p}`,
        title: `P${p}`,
        tasks: tasks.filter(t => t.priority === p)
      }))

    case 'due_date':
      const today = todayISO()
      const weekEnd = addDays(today, 7)

      return [
        {
          id: 'overdue',
          title: 'Overdue',
          tasks: tasks.filter(t => t.due_date && t.due_date < today)
        },
        {
          id: 'today',
          title: 'Today',
          tasks: tasks.filter(t => t.due_date === today)
        },
        {
          id: 'week',
          title: 'This Week',
          tasks: tasks.filter(t =>
            t.due_date && t.due_date > today && t.due_date <= weekEnd
          )
        },
        {
          id: 'later',
          title: 'Later',
          tasks: tasks.filter(t => t.due_date && t.due_date > weekEnd)
        },
        {
          id: 'none',
          title: 'No Date',
          tasks: tasks.filter(t => !t.due_date)
        }
      ]
  }
}
```

### Anti-Patterns to Avoid

- **Separate state per column:** Don't use `setTodoItems`, `setDoneItems`. Keep single `tasks` array, derive columns.
- **Router for simple navigation:** HashRouter adds complexity. State-based nav sufficient for task detail.
- **Rendering sortable in DragOverlay:** Use presentational component in overlay, not same useSortable component.
- **localStorage for filter state:** SQLite settings already exists, keep single source of truth.
- **Re-rendering entire board on drag:** Use proper keys, memoize columns.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-drop | HTML5 DnD API | @dnd-kit | Accessibility, touch, keyboard, smooth animations |
| Markdown rendering | dangerouslySetInnerHTML | react-markdown | XSS safety, virtual DOM diffing |
| Collision detection | Manual rect math | dnd-kit closestCorners | Edge cases, performance |
| Filter persistence | Manual localStorage | SQLite settings | Consistency with rest of app |
| Sortable reordering | Manual splice | arrayMove from @dnd-kit/sortable | Immutable, correct |

**Key insight:** dnd-kit handles all the hard parts of DnD (accessibility, touch, keyboard, animations, collision) that are easy to get wrong.

## Common Pitfalls

### Pitfall 1: DragOverlay Rendering Same Sortable Component

**What goes wrong:** Errors about duplicate IDs, drag behavior breaks
**Why it happens:** useSortable creates draggable+droppable with same ID
**How to avoid:** DragOverlay should render presentational component only

```tsx
// BAD
<DragOverlay>
  <SortableKanbanCard task={activeTask} /> // Uses useSortable internally
</DragOverlay>

// GOOD
<DragOverlay>
  <KanbanCard task={activeTask} isDragging /> // Pure presentational
</DragOverlay>
```

**Warning signs:** Console errors about duplicate IDs

### Pitfall 2: Too Many Re-renders in onDragOver

**What goes wrong:** Laggy drag, "too many re-renders" error
**Why it happens:** Cross-container drag calls setState on every pixel move
**How to avoid:** Use onDragEnd for cross-column moves, onDragOver only for visual feedback

```tsx
// For simple kanban: onDragEnd is sufficient
// Only use onDragOver if you need sorting WITHIN columns during drag
```

**Warning signs:** Janky drag animation, console minified errors

### Pitfall 3: Filter State Not Loading on Project Switch

**What goes wrong:** Filters reset when switching projects
**Why it happens:** Effect doesn't re-run, or loads after render
**How to avoid:** Key component on projectId or use loading state

```tsx
// Option 1: Key the component
<FilterPopover key={selectedProjectId} ... />

// Option 2: Loading state
if (!filterLoaded) return <Skeleton />
```

**Warning signs:** Flicker on project switch, wrong filters shown

### Pitfall 4: Subtasks Appearing in Kanban

**What goes wrong:** Subtasks show as cards in columns
**Why it happens:** Not filtering by `parent_id IS NULL`
**How to avoid:** Filter root tasks only for kanban

```tsx
const rootTasks = tasks.filter(t => t.parent_id === null)
// Use rootTasks for kanban, full tasks list for detail page
```

**Warning signs:** Duplicate-looking tasks, nested items in columns

### Pitfall 5: Due Date Grouping Timezone Issues

**What goes wrong:** Tasks in wrong due date bucket
**Why it happens:** Comparing Date objects vs ISO strings
**How to avoid:** Keep everything as ISO date strings (YYYY-MM-DD)

```tsx
// Get today as ISO string without time component
const todayISO = () => new Date().toISOString().split('T')[0]

// Compare strings directly
const isOverdue = task.due_date && task.due_date < todayISO()
```

**Warning signs:** "Today" tasks showing as overdue/tomorrow

## Code Examples

### Subtask Accordion

```tsx
// Task already has parent_id in schema, no migration needed
// Fetch subtasks: tasks.filter(t => t.parent_id === taskId)

function SubtaskAccordion({ parentTaskId }: Props) {
  const [subtasks, setSubtasks] = useState<Task[]>([])
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    // Get subtasks from already-loaded tasks or fetch
    window.api.db.getTasks().then(all => {
      setSubtasks(all.filter(t => t.parent_id === parentTaskId))
    })
  }, [parentTaskId])

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full p-2">
        <ChevronRight className={cn("h-4 w-4", expanded && "rotate-90")} />
        <span>Subtasks ({subtasks.length})</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 pl-6">
        {subtasks.map(sub => (
          <SubtaskItem key={sub.id} subtask={sub} ... />
        ))}
        <Button variant="ghost" size="sm">
          <Plus className="h-4 w-4 mr-1" /> Add subtask
        </Button>
      </CollapsibleContent>
    </Collapsible>
  )
}
```

### Task Detail Page Layout

```tsx
function TaskDetailPage({ taskId, onBack }: Props) {
  const [task, setTask] = useState<Task | null>(null)
  const [description, setDescription] = useState('')

  useEffect(() => {
    window.api.db.getTask(taskId).then(t => {
      if (t) {
        setTask(t)
        setDescription(t.description ?? '')
      }
    })
  }, [taskId])

  if (!task) return <Skeleton />

  const handleSaveDescription = async () => {
    const updated = await window.api.db.updateTask({
      id: task.id,
      description: description || null
    })
    setTask(updated)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="border-b p-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <InlineEditTitle
          value={task.title}
          onSave={async (title) => {
            const updated = await window.api.db.updateTask({ id: task.id, title })
            setTask(updated)
          }}
        />
      </header>

      {/* Metadata row */}
      <TaskMetadataRow task={task} onUpdate={setTask} />

      {/* Description */}
      <div className="p-6">
        <MarkdownEditor
          value={description}
          onChange={setDescription}
          onSave={handleSaveDescription}
        />
      </div>

      {/* Subtasks */}
      <div className="border-t">
        <SubtaskAccordion parentTaskId={task.id} />
      </div>
    </div>
  )
}
```

### Creating Subtask

```tsx
// API already supports parentId via CreateTaskInput
// Need to add parentId to input type

// In src/shared/types/api.ts
interface CreateTaskInput {
  projectId: string
  parentId?: string      // Add this
  title: string
  description?: string
  status?: string
  priority?: number
  dueDate?: string
}

// In src/main/ipc/database.ts
ipcMain.handle('db:tasks:create', (_, data: CreateTaskInput) => {
  const id = crypto.randomUUID()
  const stmt = db.prepare(`
    INSERT INTO tasks (id, project_id, parent_id, title, description, status, priority, due_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  stmt.run(
    id,
    data.projectId,
    data.parentId ?? null,      // Add this
    data.title,
    data.description ?? null,
    data.status ?? 'inbox',
    data.priority ?? 3,
    data.dueDate ?? null
  )
  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-beautiful-dnd | @dnd-kit | 2022 (RBD deprecated) | Active maintenance, TypeScript, accessibility |
| Redux for filters | useState + SQLite | 2024 | Simpler, persisted, no extra deps |
| react-router | State-based nav | Always for Electron | Simpler, no file:// issues |
| contenteditable | textarea + markdown | - | Safer, predictable |

**Deprecated/outdated:**
- react-beautiful-dnd: Atlassian deprecated 2022
- @hello-pangea/dnd: Fork of RBD, maintained but dnd-kit preferred
- Global state for view data: Local state + IPC sufficient

## Open Questions

1. **Sorting within columns**
   - What we know: dnd-kit supports sorting within columns via onDragOver
   - What's unclear: Is intra-column sorting needed? SPEC shows status columns but no explicit sort requirement
   - Recommendation: Start with cross-column only (simpler). Add intra-column sort later if requested.

2. **Markdown editor complexity**
   - What we know: @uiw/react-md-editor provides toolbar, syntax highlighting
   - What's unclear: Is toolbar needed for task descriptions?
   - Recommendation: Start with plain textarea + react-markdown preview. Add rich editor later if requested.

3. **Tag assignment UI**
   - What we know: task_tags junction table exists, Tags CRUD exists
   - What's unclear: Multi-select component for task tags
   - Recommendation: Use shadcn Popover with checkboxes, similar to Filter by tags UI.

## Sources

### Primary (HIGH confidence)
- [dnd-kit Documentation](https://docs.dndkit.com/presets/sortable) - Sortable API, collision detection, sensors
- [react-markdown GitHub](https://github.com/remarkjs/react-markdown) - Safe rendering, plugins
- [shadcn/ui Kanban](https://www.shadcn.io/components/data/kanban) - DnD Kit + shadcn pattern

### Secondary (MEDIUM confidence)
- [LogRocket dnd-kit Kanban](https://blog.logrocket.com/build-kanban-board-dnd-kit-react/) - Implementation patterns
- [Chetan Verma Kanban](https://www.chetanverma.com/blog/how-to-create-an-awesome-kanban-board-using-dnd-kit) - Multi-container patterns
- [Josh Comeau localStorage](https://www.joshwcomeau.com/react/persisting-react-state-in-localstorage/) - State persistence patterns
- [Georgegriff/react-dnd-kit-tailwind-shadcn-ui](https://github.com/Georgegriff/react-dnd-kit-tailwind-shadcn-ui) - Accessible kanban reference

### Tertiary (LOW confidence)
- WebSearch community patterns for Electron navigation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - dnd-kit actively maintained, 5M+ weekly downloads
- Architecture: HIGH - Patterns from official docs and community examples
- Subtasks: HIGH - parent_id already in schema
- Filter persistence: HIGH - settings table already exists
- Pitfalls: MEDIUM - Based on GitHub issues and community reports

**Research date:** 2026-01-17
**Valid until:** 2026-02-17 (dnd-kit stable, 30 days)
