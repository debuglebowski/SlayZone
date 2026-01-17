# Phase 3: Navigation + Projects - Research

**Researched:** 2026-01-17
**Domain:** React UI patterns, shadcn components, state management, SQLite schema
**Confidence:** HIGH

## Summary

Phase 3 adds sidebar navigation, project management UI, and user settings. shadcn/ui provides all required components: Sidebar, ContextMenu, Dialog. Color picker needs external library (react-colorful, 2.8KB). Tags require new database tables. Database path change requires app restart due to better-sqlite3's synchronous nature.

**Primary recommendation:** Use shadcn Sidebar + ContextMenu + Dialog components. Add react-colorful for color picker. Keep state in React useState (no Zustand needed yet). Tags via junction table. Settings in SQLite.

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| @radix-ui/react-dialog | 1.1.15 | Modals | Installed |
| @radix-ui/react-popover | 1.1.15 | Dropdowns | Installed |
| @radix-ui/react-select | 2.2.6 | Select inputs | Installed |

### New Components to Add
| Component | Install Command | Purpose |
|-----------|-----------------|---------|
| Sidebar | `npx shadcn@latest add sidebar` | Main nav sidebar |
| Context Menu | `npx shadcn@latest add context-menu` | Right-click menus |
| Dropdown Menu | `npx shadcn@latest add dropdown-menu` | User settings menu |
| Separator | `npx shadcn@latest add separator` | Visual dividers |

### New Library
| Library | Version | Size | Purpose |
|---------|---------|------|---------|
| react-colorful | latest | 2.8KB gzip | Color picker |

**Installation:**
```bash
npx shadcn@latest add sidebar context-menu dropdown-menu separator
npm install react-colorful
```

## Architecture Patterns

### Recommended Component Structure
```
src/renderer/src/
├── components/
│   ├── sidebar/
│   │   ├── AppSidebar.tsx       # Main sidebar wrapper
│   │   ├── ProjectItem.tsx      # Single project blob
│   │   └── ProjectContextMenu.tsx
│   ├── dialogs/
│   │   ├── CreateProjectDialog.tsx
│   │   ├── ProjectSettingsDialog.tsx
│   │   ├── DeleteProjectDialog.tsx
│   │   └── UserSettingsDialog.tsx
│   └── ui/
│       ├── color-picker.tsx     # Wrapper for react-colorful
│       └── ... (shadcn components)
└── App.tsx
```

### Pattern 1: Sidebar with Project Blobs

**What:** Vertical sidebar with colored 2-letter project abbreviations
**When to use:** Main app navigation

```tsx
// Source: shadcn/ui sidebar docs
import { Sidebar, SidebarContent, SidebarGroup, SidebarMenu,
         SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar"

function ProjectBlob({ project, selected, onClick }) {
  const abbrev = project.name.slice(0, 2).toUpperCase()
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-10 h-10 rounded-lg flex items-center justify-center text-xs font-semibold text-white",
        selected && "ring-2 ring-primary ring-offset-2"
      )}
      style={{ backgroundColor: project.color }}
    >
      {abbrev}
    </button>
  )
}
```

### Pattern 2: Context Menu with Dialog

**What:** Right-click menu that opens modal dialogs
**When to use:** Project settings, delete confirmation

```tsx
// Source: shadcn/ui docs - Dialog + ContextMenu integration
// Wrap ContextMenu inside Dialog for proper z-index/modal handling

<Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
  <ContextMenu>
    <ContextMenuTrigger asChild>
      <ProjectBlob ... />
    </ContextMenuTrigger>
    <ContextMenuContent>
      <ContextMenuItem onSelect={() => setSettingsOpen(true)}>
        Settings
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        onSelect={() => setDeleteOpen(true)}
        className="text-destructive"
      >
        Delete
      </ContextMenuItem>
    </ContextMenuContent>
  </ContextMenu>
  <DialogContent>
    <ProjectSettingsForm project={project} />
  </DialogContent>
</Dialog>
```

### Pattern 3: Color Picker Integration

**What:** Hex color picker for project colors
**When to use:** Create/edit project dialogs

```tsx
// Source: react-colorful GitHub
import { HexColorPicker, HexColorInput } from "react-colorful"

function ColorPicker({ value, onChange }) {
  return (
    <div className="space-y-2">
      <HexColorPicker color={value} onChange={onChange} />
      <HexColorInput
        color={value}
        onChange={onChange}
        prefixed
        className="w-full px-3 py-2 border rounded-md"
      />
    </div>
  )
}
```

### Pattern 4: State Management - Keep useState

**What:** Current project selection, dialog states
**When to use:** This phase (simple state)

```tsx
// Source: React best practices 2025 - useState sufficient for this complexity
function App() {
  // Navigation state
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)

  // Dialog states (colocated with triggering component)
  const [createProjectOpen, setCreateProjectOpen] = useState(false)

  // Data from IPC
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])

  // "All" view = selectedProjectId is null
  const filteredTasks = selectedProjectId
    ? tasks.filter(t => t.project_id === selectedProjectId)
    : tasks
}
```

**When to upgrade to Zustand:**
- Multiple components need same state (not via props)
- State persists across page navigation
- Complex derived state

### Anti-Patterns to Avoid

- **Nesting Dialog inside ContextMenu directly:** Use `onSelect` + controlled Dialog
- **Hot-swapping database path:** better-sqlite3 is synchronous, requires restart
- **Zustand for simple state:** Adds complexity without benefit at this scale

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Color picker | Custom hue/saturation controls | react-colorful | 2.8KB, accessible, touch support |
| Right-click menu | Custom event handlers | shadcn ContextMenu | Radix handles edge cases |
| Sidebar layout | Flex/grid sidebar | shadcn Sidebar | Handles collapse, responsive |
| Modal stacking | Custom z-index management | Radix Dialog portals | Proper focus trap, escape handling |

## Common Pitfalls

### Pitfall 1: Context Menu + Dialog z-index Issues

**What goes wrong:** Dialog opens behind context menu or UI becomes unresponsive
**Why it happens:** Radix modal layers conflict
**How to avoid:**
1. Use controlled Dialog state
2. Close context menu via `onSelect` before dialog opens
3. Keep Radix packages on same version

**Warning signs:** `pointer-events: none` stuck on body

### Pitfall 2: Database Path Hot-Swap

**What goes wrong:** Attempting to change database path without restart
**Why it happens:** better-sqlite3 opens db synchronously at init
**How to avoid:**
1. Save new path to settings
2. Show "Restart required" message
3. On next app launch, use new path

**Current db init (src/main/db/index.ts) is singleton pattern - requires restart.**

### Pitfall 3: Missing "All" View Logic

**What goes wrong:** Filtering breaks when no project selected
**Why it happens:** `project_id === null` doesn't match any tasks
**How to avoid:** Treat `selectedProjectId === null` as "show all" (no filter)

### Pitfall 4: Delete Project Cascade

**What goes wrong:** Orphaned tasks after project deletion
**Why it happens:** Missing cascade or confirmation
**Current schema has `ON DELETE CASCADE` - tasks auto-delete. Still need confirmation UI.

## Code Examples

### Sidebar Provider Setup

```tsx
// Source: shadcn/ui sidebar docs
// In App.tsx or layout component
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/sidebar/AppSidebar"

function App() {
  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar />
      <SidebarInset>
        {/* Main content area */}
      </SidebarInset>
    </SidebarProvider>
  )
}
```

### IPC for Settings (if SQLite-stored)

```typescript
// Proposed IPC channels
'db:settings:get'     // (key: string) => value | null
'db:settings:set'     // (key: string, value: string) => void
'db:settings:getAll'  // () => Record<string, string>
```

## Schema Changes Required

### Tags System (Many-to-Many)

```sql
-- Migration 2: Add tags
CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#6b7280',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE task_tags (
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, tag_id)
);

CREATE INDEX idx_task_tags_task ON task_tags(task_id);
CREATE INDEX idx_task_tags_tag ON task_tags(tag_id);
```

### Settings Table

```sql
-- Migration 2: Add settings
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

**Settings keys:**
- `database_path` - User-configured path (requires restart)
- `theme` - Light/dark/system (future)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Redux for all state | useState + Zustand when needed | 2024-2025 | Less boilerplate |
| Custom sidebars | shadcn Sidebar component | Oct 2024 | Built-in collapse/responsive |
| react-color | react-colorful | 2023+ | 13x smaller bundle |

## Open Questions

1. **Tags in Phase 3 or defer?** SPEC mentions tags in filters but minimal in NAV requirements. Could add schema now, UI later.

2. **Settings storage:** SQLite settings table vs electron-store JSON? SQLite keeps single source of truth. Recommend SQLite.

3. **Sidebar collapse behavior:** SPEC shows always-visible icon sidebar. Should it collapse to icons only or stay fixed width?

## Sources

### Primary (HIGH confidence)
- [shadcn/ui Sidebar](https://ui.shadcn.com/docs/components/sidebar) - Installation, structure, props
- [shadcn/ui Context Menu](https://ui.shadcn.com/docs/components/context-menu) - Right-click menus
- [shadcn/ui Dropdown Menu](https://ui.shadcn.com/docs/components/dropdown-menu) - Dialog integration pattern
- [react-colorful GitHub](https://github.com/omgovich/react-colorful) - Color picker API

### Secondary (MEDIUM confidence)
- [Electron settings persistence patterns](https://cameronnokes.com/blog/how-to-store-user-data-in-electron/) - SQLite vs JSON tradeoffs
- [Tagging schema patterns](https://charlesleifer.com/blog/a-tour-of-tagging-schemas-many-to-many-bitmaps-and-more/) - Junction table design

### Tertiary (LOW confidence)
- [Zustand vs useState 2025](https://dev.to/saswatapal/do-you-need-state-management-in-2025-react-context-vs-zustand-vs-jotai-vs-redux-1ho) - General guidance

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - shadcn docs verified
- Architecture: HIGH - Patterns from official docs
- Schema changes: HIGH - Standard many-to-many pattern
- Pitfalls: MEDIUM - Based on GitHub issues and community reports

**Research date:** 2026-01-17
**Valid until:** 2026-02-17 (shadcn updates frequently)
