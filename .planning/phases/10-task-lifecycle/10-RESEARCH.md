# Phase 10: Task Lifecycle - Research

**Researched:** 2026-01-17
**Domain:** Task archive/delete functionality
**Confidence:** HIGH

## Summary

Current task schema has NO archived_at column - needs migration (version 4). Delete already exists (`db:tasks:delete` with CASCADE on subtasks). Archive requires: add `archived_at` column, filter in queries/UI, provide recovery mechanism.

Key findings:
- Task deletion already implemented (hard delete with CASCADE)
- Subtasks auto-delete via ON DELETE CASCADE in schema
- Kanban already filters subtasks (parent_id === null)
- Filter system exists (showDone pattern can be replicated for showArchived)

**Primary recommendation:** Add `archived_at TEXT` column, soft-archive pattern. Archive = set timestamp, unarchive = set null. Filter archived tasks at query level AND in UI filtering.

## Standard Stack

No additional libraries needed. Use existing:

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-sqlite3 | existing | SQLite access | Already used for all DB |
| shadcn/ui | existing | dropdown-menu, alert-dialog | Already has delete pattern |

### UI Patterns
| Component | Location | Use For |
|-----------|----------|---------|
| dropdown-menu | `@/components/ui/dropdown-menu` | Task actions menu |
| alert-dialog | `@/components/ui/alert-dialog` | Delete confirmation |
| ArchiveIcon | lucide-react | Archive action |
| Trash2Icon | lucide-react | Delete action |

## Architecture Patterns

### Schema Migration
```sql
-- Migration version 4
ALTER TABLE tasks ADD COLUMN archived_at TEXT DEFAULT NULL;
CREATE INDEX idx_tasks_archived ON tasks(archived_at);
```

### Recommended IPC Channels
Following existing `db:entity:action` pattern:
```
db:tasks:archive      -- Set archived_at = datetime('now')
db:tasks:unarchive    -- Set archived_at = NULL
db:tasks:getArchived  -- Get all archived tasks
```

Keep existing `db:tasks:delete` for hard delete.

### Task Type Update
```typescript
// src/shared/types/database.ts
export interface Task {
  // ... existing fields
  archived_at: string | null  // Add this
}
```

### Query Filtering Pattern
```typescript
// In database.ts handlers
ipcMain.handle('db:tasks:getAll', () => {
  return db.prepare('SELECT * FROM tasks WHERE archived_at IS NULL ORDER BY created_at DESC').all()
})

ipcMain.handle('db:tasks:getArchived', () => {
  return db.prepare('SELECT * FROM tasks WHERE archived_at IS NOT NULL ORDER BY archived_at DESC').all()
})
```

### UI Action Location Options
1. **Task Detail Page Header** - Add dropdown menu next to "Work Mode" button
2. **Kanban Card** - Context menu (right-click) or hover actions

Recommended: Task Detail header dropdown. Cleaner, avoids cluttering kanban cards.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Confirmation dialog | Custom modal | shadcn alert-dialog | Already used for DeleteTaskDialog |
| Dropdown actions | Custom menu | shadcn dropdown-menu | Standard pattern, accessible |
| Archive toggle | Complex state | Simple null/timestamp check | SQLite handles it |

## Common Pitfalls

### Pitfall 1: Forgetting Subtask Handling on Archive
**What goes wrong:** Parent archived but subtasks still show up in various queries
**Why it happens:** Subtasks have their own records, not auto-filtered
**How to avoid:** Archive operation should also archive all subtasks (transaction). When archiving parent: `UPDATE tasks SET archived_at = datetime('now') WHERE id = ? OR parent_id = ?`
**Warning signs:** Orphan subtasks appearing in search results

### Pitfall 2: Not Updating All Task Queries
**What goes wrong:** Archived tasks still appear somewhere
**Why it happens:** Multiple queries exist (getAll, getByProject, getSubtasks)
**How to avoid:** Add `WHERE archived_at IS NULL` to ALL active task queries
**Warning signs:** Archived tasks appearing in kanban, search, or project views

### Pitfall 3: No Way to View/Recover Archived Tasks
**What goes wrong:** User archives task, can't find it
**Why it happens:** UI only shows active tasks
**How to avoid:** Add "Archived" section in sidebar or filter toggle
**Warning signs:** User confusion about where tasks went

### Pitfall 4: Delete Without Confirmation
**What goes wrong:** Accidental permanent data loss
**Why it happens:** Delete action too easy to trigger
**How to avoid:** Always show alert-dialog before delete. Clear messaging that it's permanent.
**Warning signs:** N/A - prevention only

## Code Examples

### Archive Task Handler
```typescript
// src/main/ipc/database.ts
ipcMain.handle('db:tasks:archive', (_, id: string) => {
  // Archive task and all subtasks in transaction
  db.transaction(() => {
    db.prepare(`
      UPDATE tasks
      SET archived_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ? OR parent_id = ?
    `).run(id, id)
  })()
  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
})

ipcMain.handle('db:tasks:unarchive', (_, id: string) => {
  db.transaction(() => {
    db.prepare(`
      UPDATE tasks
      SET archived_at = NULL, updated_at = datetime('now')
      WHERE id = ? OR parent_id = ?
    `).run(id, id)
  })()
  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
})
```

### Action Dropdown Pattern
```tsx
// Task detail header actions
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon">
      <MoreHorizontal className="size-5" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem onClick={handleArchive}>
      <Archive className="mr-2 size-4" />
      Archive
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem onClick={() => setDeleteOpen(true)} className="text-destructive">
      <Trash2 className="mr-2 size-4" />
      Delete
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### Archive View in Sidebar
```tsx
// Add to AppSidebar navigation
<SidebarMenuButton onClick={() => onSelectArchive()}>
  <Archive className="size-4" />
  <span>Archived</span>
</SidebarMenuButton>
```

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Hard delete only | Soft delete (archive) + hard delete | User can recover mistakes |
| No lifecycle states | Explicit archived_at column | Clear data model |

## Open Questions

1. **Where to show archived tasks?**
   - Option A: New "Archived" sidebar item (separate view)
   - Option B: Filter toggle in FilterBar (showArchived)
   - Recommendation: Sidebar item - cleaner separation, aligns with "All Tasks" pattern

2. **Bulk archive for completed tasks?**
   - Not in requirements, but natural extension
   - Consider: "Archive all done" button on Done column
   - Recommendation: Defer to future phase

3. **Archive vs status:archived?**
   - Using archived_at timestamp (not a status) - correct approach
   - Allows archiving tasks in any status (done tasks most common, but user might archive abandoned todo)

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `/src/main/db/migrations.ts` - current schema
- Codebase analysis: `/src/main/ipc/database.ts` - existing IPC patterns
- Codebase analysis: `/src/renderer/src/lib/kanban.ts` - filtering logic
- Codebase analysis: `/src/renderer/src/components/DeleteTaskDialog.tsx` - delete pattern

### Secondary (MEDIUM confidence)
- shadcn/ui documentation - dropdown-menu, alert-dialog patterns

## Metadata

**Confidence breakdown:**
- Schema changes: HIGH - simple ALTER TABLE, existing pattern
- IPC channels: HIGH - follows existing db:entity:action pattern
- UI patterns: HIGH - existing components, existing delete dialog pattern
- Subtask handling: HIGH - CASCADE exists, transaction pattern clear

**Research date:** 2026-01-17
**Valid until:** 60 days (stable local app, no external API changes)

---

## Implementation Checklist (for planner)

### Migration
- [ ] Add migration version 4: `archived_at TEXT`
- [ ] Add index on archived_at

### Backend (IPC)
- [ ] Add `db:tasks:archive` handler
- [ ] Add `db:tasks:unarchive` handler
- [ ] Add `db:tasks:getArchived` handler
- [ ] Update `db:tasks:getAll` to filter archived
- [ ] Update `db:tasks:getByProject` to filter archived
- [ ] Update preload/index.ts with new methods
- [ ] Update api.ts types

### Types
- [ ] Add `archived_at` to Task interface
- [ ] Add archive/unarchive to ElectronAPI type

### UI
- [ ] Add action dropdown to TaskDetailPage header
- [ ] Archive action with icon
- [ ] Delete action (uses existing DeleteTaskDialog)
- [ ] Add "Archived" sidebar navigation item
- [ ] Create ArchivedTasksView (list, not kanban)
- [ ] Unarchive action in archived view
