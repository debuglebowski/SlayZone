# Phase 13: Task Screen Redesign - Research

**Researched:** 2026-01-17
**Domain:** React UI layout, Tailwind CSS, existing component patterns
**Confidence:** HIGH

## Summary

This phase transforms the task detail page from a single-column layout with horizontal metadata row to a two-column layout with a right metadata sidebar. The current implementation uses `max-w-4xl` centered content with a bordered header and metadata displayed as a horizontal flex row.

Key changes required:
- Replace horizontal metadata row with vertical sidebar
- Remove header border
- Maintain narrow main content width
- Make subtasks clickable for navigation
- Default subtasks to collapsed state

**Primary recommendation:** Extract TaskMetadataRow into TaskMetadataSidebar, use flex layout with fixed-width sidebar, leverage existing Collapsible component with `defaultOpen={false}`.

## Standard Stack

### Core (already in codebase)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tailwind CSS | 4.x | Layout & styling | Already used throughout |
| @radix-ui/react-collapsible | current | Accordion behavior | Already used in SubtaskAccordion |
| lucide-react | current | Icons | Already used |

### No New Dependencies Needed
This phase uses only existing patterns and libraries.

## Architecture Patterns

### Current Layout Structure (TaskDetailPage.tsx)
```
<div className="min-h-screen">
  <header className="border-b ...">  // Has border - needs removal
    [back] [title] [menu]
  </header>
  <main className="mx-auto max-w-4xl p-6">  // Single column
    <TaskMetadataRow />  // Horizontal - needs sidebar conversion
    <MarkdownEditor />
    <SubtaskAccordion />
  </main>
</div>
```

### Target Layout Structure
```
<div className="min-h-screen">
  <header className="...">  // No border-b
    [back] [title] [menu]
  </header>
  <div className="mx-auto max-w-5xl flex gap-6 p-6">
    <main className="flex-1 min-w-0 max-w-2xl">  // Narrow content
      <MarkdownEditor />
      <SubtaskAccordion />  // collapsed by default
    </main>
    <aside className="w-64 shrink-0">  // Fixed sidebar
      <TaskMetadataSidebar />  // Vertical layout
    </aside>
  </div>
</div>
```

### Pattern 1: Content + Sidebar Layout
**What:** Main content area with fixed-width sidebar
**When to use:** Detail pages with metadata
**Example (from WorkModePage.tsx):**
```tsx
<div className="flex flex-1 min-h-0">
  <main className="flex-1 min-h-0">
    {/* Main content */}
  </main>
  <aside className="w-64 border-l flex flex-col">
    {/* Sidebar */}
  </aside>
</div>
```

### Pattern 2: Narrow Centered Content
**What:** Constrained width content for readability
**When to use:** Text-heavy pages
**Example (from TaskDetailPage.tsx, ArchivedTasksView.tsx):**
```tsx
<main className="mx-auto max-w-4xl p-6">
```

### Pattern 3: Collapsible Default Closed
**What:** Radix Collapsible with controlled open state
**Current SubtaskAccordion behavior:**
```tsx
const [expanded, setExpanded] = useState(false)  // Default false
useEffect(() => {
  // Currently opens if subtasks exist - remove this
  setExpanded(loaded.length > 0)
}, [])
```
**Target:** Remove auto-expand, keep collapsed.

### Pattern 4: Subtask Navigation
**What:** Click handler on subtask to navigate to task detail
**Current SubtaskItem:** Click edits title inline
**Target:** Primary click navigates, separate edit affordance

### Anti-Patterns to Avoid
- **Horizontal metadata row:** Poor use of space, requires wrapping
- **Auto-expand on load:** Users may not want subtasks visible
- **Click-to-edit as only interaction:** Prevents navigation

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Collapsible | Custom accordion | @radix-ui/react-collapsible | Already used, accessible |
| Calendar picker | Custom datepicker | Calendar component | Already in codebase |
| Select dropdowns | Custom select | Select component | Already in codebase |

## Common Pitfalls

### Pitfall 1: Sidebar Width Consistency
**What goes wrong:** Sidebar takes different widths on different screens
**Why it happens:** Using percentage or flex-grow instead of fixed width
**How to avoid:** Use fixed `w-64` (256px) with `shrink-0`
**Warning signs:** Sidebar width changes when content changes

### Pitfall 2: Content Overflow with Sidebar
**What goes wrong:** Long content pushes sidebar off screen
**Why it happens:** Missing `min-w-0` on flex child
**How to avoid:** Add `min-w-0` to main content area
**Warning signs:** Horizontal scroll appears

### Pitfall 3: Subtask Click Conflicts
**What goes wrong:** Edit mode and navigation conflict
**Why it happens:** Single click handler for multiple actions
**How to avoid:** Use explicit navigation area vs edit trigger
**Warning signs:** Unexpected mode changes

### Pitfall 4: Breaking Navigation State
**What goes wrong:** Clicking subtask loses parent context
**Why it happens:** Flat navigation without breadcrumb or back-to-parent
**How to avoid:** App.tsx `setView({ type: 'task-detail', taskId: subtaskId })` works as-is
**Warning signs:** User can't return to parent task

## Code Examples

### Header Without Border (current has border-b)
```tsx
// Current:
<header className="sticky top-0 z-10 border-b bg-background p-4">

// Target:
<header className="sticky top-0 z-10 bg-background p-4">
```

### Content + Sidebar Flex Layout
```tsx
<div className="mx-auto max-w-5xl p-6">
  <div className="flex gap-6">
    <main className="flex-1 min-w-0 max-w-2xl">
      {/* Description, Subtasks */}
    </main>
    <aside className="w-64 shrink-0">
      <TaskMetadataSidebar />
    </aside>
  </div>
</div>
```

### Vertical Metadata Sidebar Layout
```tsx
<div className="space-y-4">
  {/* Status */}
  <div>
    <label className="text-sm text-muted-foreground block mb-1">Status</label>
    <Select value={task.status} onValueChange={handleStatusChange}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      {/* ... */}
    </Select>
  </div>

  {/* Priority */}
  <div>
    <label className="text-sm text-muted-foreground block mb-1">Priority</label>
    {/* ... */}
  </div>

  {/* Due Date */}
  {/* Tags */}
  {/* Blocked */}
</div>
```

### Subtask Default Collapsed
```tsx
// Change in SubtaskAccordion.tsx
const [expanded, setExpanded] = useState(false)

useEffect(() => {
  const loadSubtasks = async () => {
    const loaded = await window.api.db.getSubtasks(parentTaskId)
    setSubtasks(loaded)
    // REMOVE: setExpanded(loaded.length > 0)
    setLoading(false)
  }
  loadSubtasks()
}, [parentTaskId])
```

### Clickable Subtask Navigation
```tsx
// SubtaskItem needs onNavigate prop
interface SubtaskItemProps {
  subtask: Task
  onUpdate: (subtask: Task) => void
  onDelete: (subtaskId: string) => void
  onNavigate: (subtaskId: string) => void  // NEW
}

// In render:
<div
  onClick={() => onNavigate(subtask.id)}
  className="cursor-pointer hover:bg-muted/50 rounded px-2 py-1"
>
  <Checkbox onClick={(e) => e.stopPropagation()} />
  <span>{subtask.title}</span>
</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Horizontal metadata | Sidebar metadata | This phase | Better space usage |
| Auto-expand subtasks | Collapsed default | This phase | Cleaner initial view |
| Edit-only subtasks | Navigable subtasks | This phase | Subtask detail access |

## Open Questions

1. **Sidebar positioning on narrow screens?**
   - What we know: Desktop uses side-by-side
   - What's unclear: Mobile/narrow breakpoint behavior
   - Recommendation: Stack sidebar below content on mobile (`flex-col md:flex-row`)

2. **Subtask edit vs navigate affordance?**
   - What we know: Need both edit and navigate
   - What's unclear: Exact UI pattern
   - Recommendation: Click navigates, inline edit button or double-click edits

## Sources

### Primary (HIGH confidence)
- `/Users/Kalle/dev/projects/focus/src/renderer/src/components/task-detail/TaskDetailPage.tsx` - current implementation
- `/Users/Kalle/dev/projects/focus/src/renderer/src/components/task-detail/TaskMetadataRow.tsx` - current metadata layout
- `/Users/Kalle/dev/projects/focus/src/renderer/src/components/task-detail/SubtaskAccordion.tsx` - current collapse behavior
- `/Users/Kalle/dev/projects/focus/src/renderer/src/components/work-mode/WorkModePage.tsx` - sidebar pattern reference

### Secondary (MEDIUM confidence)
- Tailwind CSS flex utilities documentation

## Metadata

**Confidence breakdown:**
- Layout patterns: HIGH - verified from existing codebase
- Sidebar structure: HIGH - WorkModePage demonstrates pattern
- Subtask behavior: HIGH - SubtaskAccordion code reviewed
- Navigation: HIGH - App.tsx view state pattern verified

**Research date:** 2026-01-17
**Valid until:** 2026-02-17 (stable patterns)
