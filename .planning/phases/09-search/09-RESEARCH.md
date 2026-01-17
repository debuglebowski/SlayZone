# Phase 9: Search - Research

**Researched:** 2026-01-17
**Domain:** Command palette / global search UI
**Confidence:** HIGH

## Summary

Global search modal using shadcn/ui Command component (built on cmdk). Search already loaded tasks/projects in memory - no new IPC needed. Keyboard shortcut via existing react-hotkeys-hook. Navigate to task detail or select project on result click.

**Primary recommendation:** Use shadcn Command component with CommandDialog, filter in-memory data client-side, use existing useHotkeys pattern for Cmd/Ctrl+K.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| cmdk | ^1.0.0 | Command menu primitives | shadcn Command wraps this, battle-tested fuzzy search |
| @radix-ui/react-dialog | already installed | CommandDialog uses this internally | Already in project |
| lucide-react | 0.562.0 | Icons for task/project distinction | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-hotkeys-hook | 5.2.3 | Cmd+K shortcut | Already in project, proven pattern in App.tsx |

### Not Needed
- No new IPC - tasks/projects already loaded in App.tsx state
- No debouncing library - cmdk handles filtering internally
- No fuzzy search library - cmdk uses command-score internally

**Installation:**
```bash
pnpm dlx shadcn@latest add command
```

This adds cmdk dependency automatically.

## Architecture Patterns

### Component Structure
```
src/renderer/src/
├── components/
│   ├── ui/
│   │   └── command.tsx        # shadcn Command (added via CLI)
│   └── dialogs/
│       └── SearchDialog.tsx   # Search modal component
```

### Pattern 1: SearchDialog Component

**What:** Modal dialog with command menu for searching tasks and projects
**When to use:** Global search triggered by Cmd/Ctrl+K
**Example:**
```typescript
// Source: shadcn/ui Command docs
interface SearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tasks: Task[]
  projects: Project[]
  onSelectTask: (taskId: string) => void
  onSelectProject: (projectId: string) => void
}

export function SearchDialog({
  open, onOpenChange, tasks, projects, onSelectTask, onSelectProject
}: SearchDialogProps) {
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search tasks and projects..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Projects">
          {projects.map(p => (
            <CommandItem key={p.id} onSelect={() => onSelectProject(p.id)}>
              <FolderIcon className="mr-2 h-4 w-4" />
              {p.name}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Tasks">
          {tasks.map(t => (
            <CommandItem key={t.id} onSelect={() => onSelectTask(t.id)}>
              <CheckSquareIcon className="mr-2 h-4 w-4" />
              {t.title}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
```

### Pattern 2: Keyboard Shortcut in App.tsx

**What:** Add Cmd/Ctrl+K hotkey using existing pattern
**When to use:** Global shortcut registration
**Example:**
```typescript
// Source: existing App.tsx useHotkeys pattern
const [searchOpen, setSearchOpen] = useState(false)

useHotkeys('mod+k', (e) => {
  e.preventDefault()
  setSearchOpen(true)
}, { enableOnFormTags: true })  // Allow in inputs unlike 'n' key
```

### Pattern 3: Result Navigation

**What:** Handle selection to navigate appropriately
**When to use:** When user selects a search result
**Example:**
```typescript
const handleSelectTask = (taskId: string) => {
  setSearchOpen(false)
  openTaskDetail(taskId)  // existing function
}

const handleSelectProject = (projectId: string) => {
  setSearchOpen(false)
  setSelectedProjectId(projectId)  // existing function
}
```

### Anti-Patterns to Avoid
- **Don't create new IPC for search:** Data already in App.tsx state, filter client-side
- **Don't use shouldFilter={false}:** Let cmdk handle filtering - it's optimized
- **Don't debounce input:** cmdk's filtering is instant, no lag even with hundreds of items

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fuzzy search | Custom search algorithm | cmdk's built-in filter | Uses command-score, handles edge cases |
| Keyboard nav | Arrow key handlers | CommandList | Handles up/down/enter/esc automatically |
| Modal focus | Focus trap logic | CommandDialog | Radix dialog handles focus management |
| Shortcut parsing | Key event parsing | useHotkeys 'mod+k' | 'mod' handles cmd on mac, ctrl on windows |

**Key insight:** cmdk + shadcn Command handles all the hard parts. SearchDialog is just composition.

## Common Pitfalls

### Pitfall 1: Filtering Subtasks
**What goes wrong:** Search returns subtasks, clicking navigates but parent context lost
**Why it happens:** Subtasks have parent_id set, not independent navigation targets
**How to avoid:** Filter to only top-level tasks: `tasks.filter(t => !t.parent_id)`
**Warning signs:** Search results include tasks that aren't clickable in kanban

### Pitfall 2: Keywords for Better Search
**What goes wrong:** Can't find task by project name or description content
**Why it happens:** cmdk only searches the text content by default
**How to avoid:** Use CommandItem keywords prop for additional searchable text
**Warning signs:** User searches "Home" but task in "Home Project" doesn't appear

### Pitfall 3: Empty State Without Data
**What goes wrong:** CommandEmpty shows when no search but also no items
**Why it happens:** CommandEmpty shows whenever CommandList has no visible items
**How to avoid:** Check if there are any tasks/projects before showing empty
**Warning signs:** "No results" appears before user types anything

### Pitfall 4: Shortcut Conflict with Inputs
**What goes wrong:** Cmd+K doesn't work when focused in text input
**Why it happens:** enableOnFormTags defaults to false
**How to avoid:** Set enableOnFormTags: true for global shortcuts like search
**Warning signs:** Shortcut works on kanban but not in task detail page inputs

## Code Examples

### Complete SearchDialog Component
```typescript
// Source: shadcn/ui Command docs + project patterns
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Folder, CheckSquare } from "lucide-react"
import type { Task, Project } from "@/shared/types/database"

interface SearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tasks: Task[]
  projects: Project[]
  onSelectTask: (taskId: string) => void
  onSelectProject: (projectId: string) => void
}

export function SearchDialog({
  open,
  onOpenChange,
  tasks,
  projects,
  onSelectTask,
  onSelectProject,
}: SearchDialogProps) {
  // Filter to top-level tasks only
  const searchableTasks = tasks.filter(t => !t.parent_id)

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search tasks and projects..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {projects.length > 0 && (
          <CommandGroup heading="Projects">
            {projects.map((project) => (
              <CommandItem
                key={project.id}
                value={project.name}
                onSelect={() => {
                  onSelectProject(project.id)
                  onOpenChange(false)
                }}
              >
                <Folder className="mr-2 h-4 w-4" />
                <span>{project.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {searchableTasks.length > 0 && (
          <CommandGroup heading="Tasks">
            {searchableTasks.map((task) => (
              <CommandItem
                key={task.id}
                value={task.title}
                keywords={[
                  // Include project name in search
                  projects.find(p => p.id === task.project_id)?.name ?? ''
                ].filter(Boolean)}
                onSelect={() => {
                  onSelectTask(task.id)
                  onOpenChange(false)
                }}
              >
                <CheckSquare className="mr-2 h-4 w-4" />
                <span>{task.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}
```

### App.tsx Integration
```typescript
// Add state
const [searchOpen, setSearchOpen] = useState(false)

// Add hotkey (after existing useHotkeys calls)
useHotkeys('mod+k', (e) => {
  e.preventDefault()
  setSearchOpen(true)
}, { enableOnFormTags: true })

// Add to escape handler conditions
if (searchOpen) return

// Add component in JSX (near other dialogs)
<SearchDialog
  open={searchOpen}
  onOpenChange={setSearchOpen}
  tasks={tasks}
  projects={projects}
  onSelectTask={openTaskDetail}
  onSelectProject={setSelectedProjectId}
/>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom search + modal | cmdk + shadcn Command | 2023 | Standard in React ecosystem |
| document.addEventListener for shortcuts | react-hotkeys-hook | 2022 | Cleaner React integration |

**Deprecated/outdated:**
- react-command-palette: Abandoned, use cmdk
- downshift for command menus: Overkill, cmdk is purpose-built

## Open Questions

None. All requirements map to standard patterns.

## Sources

### Primary (HIGH confidence)
- shadcn/ui Command docs: https://ui.shadcn.com/docs/components/command
- cmdk GitHub: https://github.com/pacocoursey/cmdk
- react-hotkeys-hook docs: https://react-hotkeys-hook.vercel.app/docs/api/use-hotkeys

### Secondary (MEDIUM confidence)
- lucide.dev/icons for icon selection

### Existing Codebase (HIGH confidence)
- App.tsx useHotkeys patterns (lines 130-147)
- Dialog patterns in UserSettingsDialog.tsx
- Task/Project types in database.ts

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - shadcn Command is the standard
- Architecture: HIGH - follows existing dialog patterns in codebase
- Pitfalls: HIGH - well-documented cmdk gotchas

**Research date:** 2026-01-17
**Valid until:** 90 days (stable libraries, established patterns)
