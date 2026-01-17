# Phase 7: Polish + UX - Research

**Researched:** 2026-01-17
**Domain:** Keyboard shortcuts, task prioritization, add task modal, first-run onboarding
**Confidence:** HIGH

## Summary

Phase 7 adds power user features (keyboard shortcuts, "What Next" prioritization) and first-run experience. The codebase already has patterns for dialogs (Radix Dialog), settings persistence (settings table with INSERT OR REPLACE), and tag selection (Popover + Checkbox).

For keyboard shortcuts, `react-hotkeys-hook` is the standard library - lightweight, declarative, handles input focus filtering. Radix Dialog already handles Escape to close by default. For "What Next", a weighted priority formula combining due_date urgency and priority level is straightforward. The CreateTaskDialog exists but needs tags field added. First-run onboarding can be a simple modal carousel using existing Dialog component, storing completion flag in settings.

**Primary recommendation:** Use react-hotkeys-hook for global shortcuts, extend CreateTaskDialog with existing tag pattern, implement priority formula as pure function, build onboarding as Dialog-based carousel storing state in settings table.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-hotkeys-hook | 5.2.3 | Global keyboard shortcuts | De facto standard, 5k+ stars, hook-based, handles focus scoping |

### Already in Codebase (Reuse)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| @radix-ui/react-dialog | 1.1.15 | Modals | Escape-to-close built in |
| @radix-ui/react-popover | 1.1.15 | Tag selection dropdown | Existing pattern in TaskMetadataRow |
| @radix-ui/react-checkbox | 1.3.3 | Multi-select tags | Existing pattern |

### Not Needed
| Library | Why Skip |
|---------|----------|
| react-joyride | Overkill for simple modal onboarding - existing Dialog sufficient |
| driver.js | Same - DOM highlighting not needed for welcome flow |
| electron globalShortcut | App-local shortcuts handled in renderer; global not needed |

**Installation:**
```bash
npm install react-hotkeys-hook
```

## Architecture Patterns

### Recommended Project Structure
```
src/renderer/src/
  hooks/
    useHotkeys.ts           # App-level keyboard bindings (thin wrapper)
  components/
    CreateTaskDialog.tsx    # Extend with tags field
    onboarding/
      OnboardingDialog.tsx  # Modal carousel for first run
      OnboardingStep.tsx    # Individual step content
  lib/
    prioritization.ts       # "What Next" scoring logic
```

### Pattern 1: Global Keyboard Shortcuts with react-hotkeys-hook

**What:** Declarative keyboard shortcuts at app root level
**When to use:** App-wide shortcuts like "n" for new task
**Example:**
```typescript
// Source: https://react-hotkeys-hook.vercel.app/
import { useHotkeys } from 'react-hotkeys-hook'

function App() {
  const [createOpen, setCreateOpen] = useState(false)

  // "n" opens new task modal from anywhere
  useHotkeys('n', () => setCreateOpen(true), {
    // Don't trigger when typing in input/textarea
    enableOnFormTags: false
  })

  // "esc" for navigation back (Radix handles modal close)
  useHotkeys('escape', () => {
    if (view.type === 'task-detail') closeTaskDetail()
    else if (view.type === 'work-mode') closeWorkMode()
  }, { enableOnFormTags: false })

  return (...)
}
```

**Key options:**
- `enableOnFormTags: false` - prevents triggering when focused on inputs
- `enabled: boolean` - conditional activation
- `scopes: string[]` - isolate shortcuts to contexts

### Pattern 2: Priority Score Formula

**What:** Calculate single score from due_date + priority + blocked_reason
**When to use:** "What Next" feature suggesting highest-priority task
**Example:**
```typescript
// Source: Task prioritization research - weighted formula approach
import { differenceInDays, parseISO, startOfDay } from 'date-fns'
import type { Task } from '@shared/types/database'

interface ScoredTask {
  task: Task
  score: number
}

export function calculatePriorityScore(task: Task): number {
  // Skip blocked and done tasks
  if (task.blocked_reason || task.status === 'done') return -Infinity

  // Base score from priority (P1=1000, P2=800, P3=600, P4=400, P5=200)
  const priorityScore = (6 - task.priority) * 200

  // Due date urgency (higher for closer/overdue)
  let dueDateScore = 0
  if (task.due_date) {
    const today = startOfDay(new Date())
    const dueDate = startOfDay(parseISO(task.due_date))
    const daysUntilDue = differenceInDays(dueDate, today)

    if (daysUntilDue < 0) {
      // Overdue: big boost, scaled by how overdue
      dueDateScore = 500 + Math.min(Math.abs(daysUntilDue) * 50, 500)
    } else if (daysUntilDue === 0) {
      // Due today
      dueDateScore = 400
    } else if (daysUntilDue <= 3) {
      // Due soon
      dueDateScore = 300 - (daysUntilDue * 50)
    } else if (daysUntilDue <= 7) {
      // Due this week
      dueDateScore = 100
    }
    // No boost for tasks due > 7 days out
  }

  // Status boost: "in_progress" and "todo" get slight boost over "backlog"/"inbox"
  let statusScore = 0
  if (task.status === 'in_progress') statusScore = 100
  else if (task.status === 'todo') statusScore = 50
  else if (task.status === 'review') statusScore = 75

  return priorityScore + dueDateScore + statusScore
}

export function getNextTask(tasks: Task[]): Task | null {
  const scored = tasks
    .map(task => ({ task, score: calculatePriorityScore(task) }))
    .filter(s => s.score > -Infinity)
    .sort((a, b) => b.score - a.score)

  return scored[0]?.task ?? null
}
```

### Pattern 3: Modal-Based Onboarding Carousel

**What:** Simple welcome flow using existing Dialog component
**When to use:** First launch experience
**Example:**
```typescript
// Using existing Radix Dialog pattern
import { useState, useEffect } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface OnboardingStep {
  title: string
  description: string
  image?: string
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  { title: 'Welcome to Focus', description: 'Manage tasks with focused work sessions.' },
  { title: 'Create Projects', description: 'Organize tasks by project.' },
  { title: 'Work Mode', description: 'Dedicated workspace per task with AI chat.' },
  { title: 'Keyboard Shortcuts', description: 'Press "n" for new task, "esc" to go back.' }
]

export function OnboardingDialog() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    // Check if onboarding completed
    window.api.settings.get('onboarding_completed').then(value => {
      if (value !== 'true') setOpen(true)
    })
  }, [])

  const handleNext = () => {
    if (step < ONBOARDING_STEPS.length - 1) {
      setStep(step + 1)
    } else {
      // Mark complete and close
      window.api.settings.set('onboarding_completed', 'true')
      setOpen(false)
    }
  }

  const current = ONBOARDING_STEPS[step]

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent showCloseButton={false}>
        <div className="text-center py-8">
          <h2 className="text-xl font-bold mb-4">{current.title}</h2>
          <p className="text-muted-foreground mb-8">{current.description}</p>
          <div className="flex justify-center gap-2 mb-6">
            {ONBOARDING_STEPS.map((_, i) => (
              <div key={i} className={cn(
                'w-2 h-2 rounded-full',
                i === step ? 'bg-primary' : 'bg-muted'
              )} />
            ))}
          </div>
          <Button onClick={handleNext}>
            {step < ONBOARDING_STEPS.length - 1 ? 'Next' : 'Get Started'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

### Pattern 4: Tag Selection in Forms (Existing Pattern)

**What:** Multi-select tags using Popover + Checkbox
**When to use:** Adding tags to CreateTaskDialog
**Existing implementation:** TaskMetadataRow.tsx lines 139-195

```typescript
// Simplified from existing TaskMetadataRow pattern
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
              {field.value.length === 0 ? 'Select tags...' : `${field.value.length} selected`}
            </Button>
          </FormControl>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-2">
          {tags.map(tag => (
            <label key={tag.id} className="flex items-center gap-2">
              <Checkbox
                checked={field.value.includes(tag.id)}
                onCheckedChange={(checked) => {
                  const newValue = checked
                    ? [...field.value, tag.id]
                    : field.value.filter(id => id !== tag.id)
                  field.onChange(newValue)
                }}
              />
              <span style={{ color: tag.color }}>{tag.name}</span>
            </label>
          ))}
        </PopoverContent>
      </Popover>
    </FormItem>
  )}
/>
```

### Anti-Patterns to Avoid
- **Global shortcuts without input filtering:** Always use `enableOnFormTags: false` to prevent "n" triggering while typing
- **Radix Dialog escape override:** Don't add custom escape handlers - Dialog handles it automatically
- **Complex priority ML:** Start with simple weighted formula, not ML-based systems

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Keyboard shortcuts | Custom event listeners | react-hotkeys-hook | Focus scoping, modifier handling, cleanup |
| Modal escape handling | Custom keydown listener | Radix Dialog built-in | Already works, accessible |
| Date difference calc | Manual math | date-fns differenceInDays | Timezone edge cases |
| Multi-select UI | Custom dropdown | Existing Popover+Checkbox pattern | Already in codebase |

**Key insight:** The codebase already has most UI patterns needed. Phase 7 is mostly wiring, not building new components.

## Common Pitfalls

### Pitfall 1: Keyboard Shortcuts Trigger While Typing
**What goes wrong:** User types "n" in task title, new task modal opens
**Why it happens:** Global listener not scoped to exclude form inputs
**How to avoid:** Use `enableOnFormTags: false` in useHotkeys options
**Warning signs:** Bug reports about shortcuts triggering unexpectedly

### Pitfall 2: Double Escape Handling
**What goes wrong:** Custom escape handler conflicts with Radix Dialog
**Why it happens:** Adding useHotkeys('escape') when Dialog already handles it
**How to avoid:** Only handle escape for view navigation (task-detail -> kanban), not for closing dialogs
**Warning signs:** Modal closes but also navigates back simultaneously

### Pitfall 3: Priority Formula Edge Cases
**What goes wrong:** Tasks without due dates never surface, or overdue tasks dominate
**Why it happens:** Unbalanced weight between due_date and priority
**How to avoid:** Give priority meaningful base weight even without due_date; cap overdue boost
**Warning signs:** "What Next" always picks overdue tasks regardless of priority

### Pitfall 4: Onboarding Shows Every Launch
**What goes wrong:** Users see onboarding repeatedly
**Why it happens:** Forgot to check/set completion flag
**How to avoid:** Always check settings before showing, set flag on completion
**Warning signs:** User complaints about repeated onboarding

### Pitfall 5: CreateTaskDialog Missing Tags After Submit
**What goes wrong:** Tags selected but not persisted
**Why it happens:** Only calling createTask, not setTagsForTask
**How to avoid:** Call both APIs sequentially after task creation
**Warning signs:** Tags disappear after creating task

## Code Examples

### Full Keyboard Setup in App.tsx
```typescript
// Source: Derived from react-hotkeys-hook docs + codebase patterns
import { useHotkeys } from 'react-hotkeys-hook'

function App() {
  // ... existing state ...

  // Global "n" for new task
  useHotkeys('n', () => {
    if (projects.length > 0) setCreateOpen(true)
  }, { enableOnFormTags: false })

  // Escape for view navigation (not modals - Radix handles those)
  useHotkeys('escape', () => {
    // Only handle if no dialog is open
    if (createOpen || editingTask || deletingTask) return
    if (createProjectOpen || editingProject || deletingProject) return
    if (settingsOpen) return

    // Navigate back
    if (view.type === 'work-mode') closeWorkMode()
    else if (view.type === 'task-detail') closeTaskDetail()
  }, { enableOnFormTags: false })

  // ... rest of component ...
}
```

### CreateTaskDialog with Tags
```typescript
// Extend existing schema
const createTaskSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(5000),
  status: taskStatusEnum,
  priority: prioritySchema,
  dueDate: z.string().nullable(),
  tagIds: z.array(z.string())  // Add this
})

// In onSubmit handler
const onSubmit = async (data: CreateTaskFormData) => {
  const task = await window.api.db.createTask({...})

  // Set tags after task creation
  if (data.tagIds.length > 0) {
    await window.api.taskTags.setTagsForTask(task.id, data.tagIds)
  }

  onCreated(task)
}
```

### "What Next" Hook
```typescript
// hooks/useWhatNext.ts
import { useMemo } from 'react'
import { getNextTask } from '@/lib/prioritization'
import type { Task } from '@shared/types/database'

export function useWhatNext(tasks: Task[]): Task | null {
  return useMemo(() => getNextTask(tasks), [tasks])
}

// Usage in App.tsx
const whatNextTask = useWhatNext(projectTasks)
// Display in UI or sidebar
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom keydown listeners | react-hotkeys-hook | 2020+ | Cleaner, handles edge cases |
| Tour libraries (joyride) | Simple modal carousel | Recent | Lighter weight for basic flows |
| ML priority | Weighted formula | Always simple first | Simpler, predictable, debuggable |

**Deprecated/outdated:**
- react-hotkeys (without -hook): Older class-based API, use hook version
- Mousetrap: Not React-native, requires manual cleanup

## Open Questions

1. **"What Next" UI placement?**
   - What we know: Need to show suggested task somewhere
   - What's unclear: Sidebar? Header? Floating badge?
   - Recommendation: Start with header area near "New Task" button

2. **Skip button on onboarding?**
   - What we know: Some users want to skip
   - What's unclear: Required or optional?
   - Recommendation: Add skip, still mark completed

3. **Tag creation from CreateTaskDialog?**
   - What we know: User might want new tag while creating task
   - What's unclear: Inline creation vs "go to settings"?
   - Recommendation: Keep simple - link to settings, don't inline

## Sources

### Primary (HIGH confidence)
- react-hotkeys-hook docs: https://react-hotkeys-hook.vercel.app/
- Radix Dialog docs: https://www.radix-ui.com/primitives/docs/components/dialog
- Existing codebase: TaskMetadataRow.tsx (tag selection pattern)
- Existing codebase: settings table API (onboarding flag storage)

### Secondary (MEDIUM confidence)
- Task prioritization formula: https://medium.com/@gid/a-rational-model-of-task-priority-16789f50287d
- Morgen priority approach: https://www.morgen.so/blog-posts/rethinking-task-prioritization-introducing-the-morgen-priority-factor

### Tertiary (LOW confidence)
- React onboarding comparison: https://onboardjs.com/blog/5-best-react-onboarding-libraries-in-2025-compared (used for research, not library selection)

## Metadata

**Confidence breakdown:**
- Keyboard shortcuts: HIGH - react-hotkeys-hook well-documented, verified
- Priority formula: HIGH - simple weighted approach, verifiable
- Onboarding: HIGH - uses existing Dialog pattern
- Tag selection: HIGH - pattern already exists in codebase

**Research date:** 2026-01-17
**Valid until:** 60 days (stable libraries, simple patterns)
