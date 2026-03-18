# Project List Drag-and-Drop Sorting — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to reorder the project sidebar list via drag and drop, persisted to SQLite.

**Architecture:** Add integer `sort_order` column to `projects` table. Wrap sidebar project list with dnd-kit's `DndContext` + `SortableContext`. On drag end, optimistically reorder state and persist via new `db:projects:reorder` IPC handler.

**Tech Stack:** SQLite (better-sqlite3), dnd-kit (already installed), React, Electron IPC

**Spec:** `docs/superpowers/specs/2026-03-18-project-list-dnd-sorting-design.md`

---

### Task 1: Database Migration — Add `sort_order` Column

**Files:**
- Modify: `packages/apps/app/src/main/db/migrations.ts:1349` (insert before closing `]`)

- [ ] **Step 1: Add migration v77**

After the v76 migration object (line 1349), add:

```typescript
  ,
  {
    version: 77,
    up: (db) => {
      db.exec(`ALTER TABLE projects ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0`)
      const rows = db.prepare('SELECT id FROM projects ORDER BY name').all() as { id: string }[]
      const update = db.prepare('UPDATE projects SET sort_order = ? WHERE id = ?')
      for (let i = 0; i < rows.length; i++) {
        update.run(i, rows[i].id)
      }
    }
  }
```

- [ ] **Step 2: Verify migration compiles**

Run: `pnpm typecheck`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add packages/apps/app/src/main/db/migrations.ts
git commit -m "feat: add sort_order column to projects table (migration v77)"
```

---

### Task 2: Type Changes — Project Interface & ElectronAPI

**Files:**
- Modify: `packages/domains/projects/src/shared/types.ts:31` (before `created_at`)
- Modify: `packages/shared/types/src/api.ts:210` (after `deleteProject`)

- [ ] **Step 1: Add `sort_order` to Project interface**

In `packages/domains/projects/src/shared/types.ts`, add after `execution_context` (line 28) and before `created_at` (line 29):

```typescript
  sort_order: number
```

- [ ] **Step 2: Add `reorderProjects` to ElectronAPI**

In `packages/shared/types/src/api.ts`, after `deleteProject` (line 210), add:

```typescript
    reorderProjects: (projectIds: string[]) => Promise<void>
```

- [ ] **Step 3: Verify types compile**

Run: `pnpm typecheck`
Expected: Errors in handlers (missing `sort_order` in queries) — that's expected and fixed in Task 3.

- [ ] **Step 4: Commit**

```bash
git add packages/domains/projects/src/shared/types.ts packages/shared/types/src/api.ts
git commit -m "feat: add sort_order to Project type and reorderProjects to ElectronAPI"
```

---

### Task 3: Backend — Handlers & Preload Bridge

**Files:**
- Modify: `packages/domains/projects/src/main/handlers.ts:140` (getAll ORDER BY)
- Modify: `packages/domains/projects/src/main/handlers.ts:146-158` (create INSERT)
- Modify: `packages/domains/projects/src/main/handlers.ts:238` (add reorder handler before closing `}`)
- Modify: `packages/domains/task/src/main/handlers.ts:702` (loadBoardData ORDER BY)
- Modify: `packages/apps/app/src/preload/index.ts:23` (after deleteProject)

- [ ] **Step 1: Write failing test for sort_order on create**

In `packages/domains/projects/src/main/handlers.test.ts`, add between the closing `})` of `db:projects:create` (line 43) and the `describe('db:projects:getAll')` block (line 45).

Note: The test harness runs migrations automatically, so `sort_order` column will exist. However, projects created by earlier tests (Alpha, Beta, Columns Project) will have `sort_order = 0` since the migration backfill uses `ORDER BY name` on an empty DB. The `sort_order` values will be assigned based on creation order.

```typescript
  test('assigns sort_order at end', () => {
    const all = h.invoke('db:projects:getAll') as { sort_order: number }[]
    const last = all[all.length - 1]
    const p = h.invoke('db:projects:create', { name: 'Zeta', color: '#123456' }) as { sort_order: number }
    expect(p.sort_order).toBe(last.sort_order + 1)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx packages/domains/projects/src/main/handlers.test.ts`
Expected: FAIL — `sort_order` is not returned or not computed

- [ ] **Step 3: Update `getAll` handler query**

In `packages/domains/projects/src/main/handlers.ts` line 140, change:

```typescript
// Before:
const rows = db.prepare('SELECT * FROM projects ORDER BY name').all() as Record<string, unknown>[]
// After:
const rows = db.prepare('SELECT * FROM projects ORDER BY sort_order').all() as Record<string, unknown>[]
```

- [ ] **Step 4: Update `create` handler to include sort_order**

In `packages/domains/projects/src/main/handlers.ts`, replace the create handler (lines 144-161) with:

```typescript
  ipcMain.handle('db:projects:create', (_, data: CreateProjectInput) => {
    const prepared = prepareProjectCreate(data)
    const { sort_order: nextOrder } = db.prepare(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 AS sort_order FROM projects'
    ).get() as { sort_order: number }
    const stmt = db.prepare(`
      INSERT INTO projects (id, name, color, path, columns_config, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      prepared.id,
      prepared.name,
      prepared.color,
      prepared.path,
      prepared.columnsConfigJson,
      nextOrder,
      prepared.createdAt,
      prepared.updatedAt
    )
    const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(prepared.id) as Record<string, unknown> | undefined
    return parseProject(row)
  })
```

- [ ] **Step 5: Run test to verify create assigns sort_order**

Run: `npx tsx packages/domains/projects/src/main/handlers.test.ts`
Expected: PASS

- [ ] **Step 6: Write failing test for reorder**

In `packages/domains/projects/src/main/handlers.test.ts`, add a new describe block:

```typescript
describe('db:projects:reorder', () => {
  test('reorders projects by given ID array', () => {
    const before = h.invoke('db:projects:getAll') as { id: string; name: string; sort_order: number }[]
    const reversed = [...before].reverse().map((p) => p.id)
    h.invoke('db:projects:reorder', reversed)
    const after = h.invoke('db:projects:getAll') as { id: string; name: string; sort_order: number }[]
    expect(after.map((p) => p.id)).toEqual(reversed)
    expect(after[0].sort_order).toBe(0)
    expect(after[1].sort_order).toBe(1)
  })
})
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npx tsx packages/domains/projects/src/main/handlers.test.ts`
Expected: FAIL — handler not registered

- [ ] **Step 8: Add reorder handler**

In `packages/domains/projects/src/main/handlers.ts`, before the closing `}` of `registerProjectHandlers` (line 238), add:

```typescript
  ipcMain.handle('db:projects:reorder', (_, projectIds: string[]) => {
    const update = db.prepare("UPDATE projects SET sort_order = ?, updated_at = datetime('now') WHERE id = ?")
    db.transaction(() => {
      projectIds.forEach((id, index) => update.run(index, id))
    })()
  })
```

- [ ] **Step 9: Run test to verify reorder passes**

Run: `npx tsx packages/domains/projects/src/main/handlers.test.ts`
Expected: PASS

- [ ] **Step 10: Update getAll test expectation**

In `packages/domains/projects/src/main/handlers.test.ts`, replace the existing `db:projects:getAll` describe block with:

```typescript
describe('db:projects:getAll', () => {
  test('returns projects ordered by sort_order', () => {
    const all = h.invoke('db:projects:getAll') as { name: string; sort_order: number }[]
    for (let i = 1; i < all.length; i++) {
      expect(all[i].sort_order).toBeGreaterThanOrEqual(all[i - 1].sort_order)
    }
  })
})
```

This replaces the old alphabetical order assertions with a sort_order ordering check.

- [ ] **Step 11: Update loadBoardData query**

In `packages/domains/task/src/main/handlers.ts` line 702, change:

```typescript
// Before:
const projectRows = db.prepare('SELECT * FROM projects ORDER BY name').all() as Record<string, unknown>[]
// After:
const projectRows = db.prepare('SELECT * FROM projects ORDER BY sort_order').all() as Record<string, unknown>[]
```

- [ ] **Step 12: Add preload bridge**

In `packages/apps/app/src/preload/index.ts`, after line 23 (`deleteProject`), add:

```typescript
    reorderProjects: (projectIds) => ipcRenderer.invoke('db:projects:reorder', projectIds),
```

- [ ] **Step 13: Run all tests**

Run: `npx tsx packages/domains/projects/src/main/handlers.test.ts`
Expected: All PASS

- [ ] **Step 14: Typecheck**

Run: `pnpm typecheck`
Expected: PASS (or only unrelated pre-existing errors)

- [ ] **Step 15: Commit**

```bash
git add packages/domains/projects/src/main/handlers.ts packages/domains/projects/src/main/handlers.test.ts packages/domains/task/src/main/handlers.ts packages/apps/app/src/preload/index.ts
git commit -m "feat: add project reorder handler, update queries to use sort_order"
```

---

### Task 4: CLI — Include `sort_order` in Project Create

**Files:**
- Modify: `packages/apps/cli/src/commands/projects.ts:131-143`

- [ ] **Step 1: Update CLI INSERT to include sort_order**

In `packages/apps/cli/src/commands/projects.ts`, replace the INSERT statement (lines 131-143):

```typescript
      const { sort_order: nextOrder } = db.query<{ sort_order: number }>(
        'SELECT COALESCE(MAX(sort_order), -1) + 1 AS sort_order FROM projects'
      )[0] ?? { sort_order: 0 }

      db.run(
        `INSERT INTO projects (id, name, color, path, columns_config, sort_order, created_at, updated_at)
         VALUES (:id, :name, :color, :path, :columnsConfig, :sortOrder, :createdAt, :updatedAt)`,
        {
          ':id': prepared.id,
          ':name': prepared.name,
          ':color': prepared.color,
          ':path': prepared.path,
          ':columnsConfig': prepared.columnsConfigJson,
          ':sortOrder': nextOrder,
          ':createdAt': prepared.createdAt,
          ':updatedAt': prepared.updatedAt,
        }
      )
```

Note: The CLI uses Bun's `db.query()` API, not better-sqlite3's `.prepare().get()`. Match the existing pattern in the file.

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/apps/cli/src/commands/projects.ts
git commit -m "feat: include sort_order in CLI project create"
```

---

### Task 5: Frontend — `useTasksData` Reorder Callback

**Files:**
- Modify: `packages/domains/tasks/src/client/useTasksData.ts`

- [ ] **Step 1: Add `reorderProjects` to the return type**

In `packages/domains/tasks/src/client/useTasksData.ts`, add to `UseTasksDataReturn` interface (after line 34, the `updateProject` line):

```typescript
  reorderProjects: (projectIds: string[]) => void
```

- [ ] **Step 2: Add the callback implementation**

After the existing `reorderTasks` callback (~line 159), add:

```typescript
  const reorderProjects = useCallback((projectIds: string[]) => {
    setProjects((prev) => {
      const previousProjects = prev
      const byId = new Map(prev.map((p) => [p.id, p]))
      const reordered = projectIds
        .map((id, index) => {
          const p = byId.get(id)
          return p ? { ...p, sort_order: index } : null
        })
        .filter((p): p is Project => p !== null)

      window.api.db.reorderProjects(projectIds).catch(() => {
        setProjects(previousProjects)
      })

      return reordered
    })
  }, [])
```

- [ ] **Step 3: Add to return object**

In the return statement (~line 230), add `reorderProjects` after `reorderTasks`:

```typescript
    reorderProjects,
```

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/domains/tasks/src/client/useTasksData.ts
git commit -m "feat: add reorderProjects callback to useTasksData"
```

---

### Task 6: Frontend — Sortable ProjectItem

**Files:**
- Modify: `packages/apps/app/src/renderer/src/components/sidebar/ProjectItem.tsx`

- [ ] **Step 1: Add useSortable to ProjectItem**

Replace the full content of `ProjectItem.tsx` with:

```tsx
import { cn } from '@slayzone/ui'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@slayzone/ui'
import { Tooltip, TooltipTrigger, TooltipContent } from '@slayzone/ui'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Project } from '@slayzone/projects/shared'

interface ProjectItemProps {
  project: Project
  selected: boolean
  onClick: () => void
  onSettings: () => void
  onDelete: () => void
  attentionCount: number
  badgeMode: 'none' | 'blob' | 'count'
}

export function ProjectItem({
  project,
  selected,
  onClick,
  onSettings,
  onDelete,
  attentionCount,
  badgeMode
}: ProjectItemProps) {
  const abbrev = project.name.slice(0, 2).toUpperCase()
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: project.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="relative">
      <Tooltip>
        <ContextMenu>
          <TooltipTrigger asChild>
            <ContextMenuTrigger asChild>
              <button
                onClick={onClick}
                className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center',
                  'text-xs font-semibold text-white transition-all',
                  selected && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                )}
                style={{ backgroundColor: project.color }}
              >
                {abbrev}
              </button>
            </ContextMenuTrigger>
          </TooltipTrigger>
          <ContextMenuContent>
            <ContextMenuItem onSelect={onSettings}>Settings</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={onDelete} className="text-destructive">
              Delete
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
        <TooltipContent side="right">{project.name}</TooltipContent>
      </Tooltip>
      {attentionCount > 0 && badgeMode === 'blob' && (
        <span
          className="absolute -top-1.5 -right-1.5 z-50 size-3 rounded-full bg-primary border-2 border-background pointer-events-none"
        />
      )}
      {attentionCount > 0 && badgeMode === 'count' && (
        <span
          className="absolute -top-1.5 -right-1.5 z-50 min-w-4 rounded-full bg-primary border-2 border-background px-1 text-[10px] font-semibold leading-4 text-center text-primary-foreground pointer-events-none"
        >
          {attentionCount}
        </span>
      )}
    </div>
  )
}
```

Key changes from original:
- Removed `framer-motion` (`motion.button` → plain `button`, removed `whileTap`/`animate`/`transition`)
- Added `useSortable` hook with ref, transform, transition, isDragging
- Sortable wrapper div is the outermost element with ref + attributes + listeners

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/apps/app/src/renderer/src/components/sidebar/ProjectItem.tsx
git commit -m "feat: make ProjectItem sortable with dnd-kit"
```

---

### Task 7: Frontend — DndContext in AppSidebar

**Files:**
- Modify: `packages/apps/app/src/renderer/src/components/sidebar/AppSidebar.tsx`

- [ ] **Step 1: Add DndContext to AppSidebar**

Add imports at the top of `AppSidebar.tsx`:

```typescript
import {
  DndContext,
  PointerSensor,
  useSensors,
  useSensor,
  closestCenter,
  type DragEndEvent
} from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
```

- [ ] **Step 2: Add `onReorderProjects` prop**

Add to `AppSidebarProps` interface (after `attentionByProject`, line 45):

```typescript
  onReorderProjects: (projectIds: string[]) => void
```

Add to the destructured props (after `attentionByProject`, line 103):

- [ ] **Step 3: Add sensors and drag handler**

Inside the `AppSidebar` function body, after the existing state/hooks (after line 108), add:

```typescript
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = projects.findIndex((p) => p.id === active.id)
    const newIndex = projects.findIndex((p) => p.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const newOrder = arrayMove(projects, oldIndex, newIndex)
    onReorderProjects(newOrder.map((p) => p.id))
  }
```

- [ ] **Step 4: Wrap project list with DndContext + SortableContext**

Inside the existing `<SidebarMenu>` (line 117), replace only the project mapping loop (lines 118-131, from `{/* Project blobs */}` through the closing `</SidebarMenuItem>` and `)}`) with the DndContext wrapper. Keep the `<SidebarMenu>` opening tag and the add-project button that follows unchanged:

```tsx
              {/* Project blobs */}
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={projects.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                  {projects.map((project) => (
                    <SidebarMenuItem key={project.id}>
                      <ProjectItem
                        project={project}
                        selected={selectedProjectId === project.id}
                        onClick={() => onSelectProject(project.id)}
                        onSettings={() => onProjectSettings(project)}
                        onDelete={() => useDialogStore.getState().openDeleteProject(project)}
                        attentionCount={attentionByProject.get(project.id) ?? 0}
                        badgeMode={sidebarBadgeMode}
                      />
                    </SidebarMenuItem>
                  ))}
                </SortableContext>
              </DndContext>

              {/* Add project button — unchanged, remains after the DndContext */}
```

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: Will fail due to missing `onReorderProjects` prop in App.tsx — fixed in Task 8

- [ ] **Step 6: Commit**

```bash
git add packages/apps/app/src/renderer/src/components/sidebar/AppSidebar.tsx
git commit -m "feat: add DndContext and SortableContext to AppSidebar"
```

---

### Task 8: Wire Up — App.tsx & ProjectSelect

**Files:**
- Modify: `packages/apps/app/src/renderer/src/App.tsx` (~line 94, ~line 628)
- Modify: `packages/domains/projects/src/client/ProjectSelect.tsx:34`

- [ ] **Step 1: Destructure `reorderProjects` from `useTasksData`**

In `App.tsx`, add `reorderProjects` to the destructured return from `useTasksData()` (~line 94):

```typescript
  const {
    tasks, projects, tags, taskTags, blockedTaskIds,
    setTasks, setProjects, setTags,
    updateTask, moveTask, reorderTasks,
    reorderProjects,
    ...
  } = useTasksData()
```

- [ ] **Step 2: Pass `onReorderProjects` to AppSidebar**

Find the `<AppSidebar` JSX (~line 628) and add:

```tsx
  onReorderProjects={reorderProjects}
```

- [ ] **Step 3: Sort ProjectSelect alphabetically**

In `packages/domains/projects/src/client/ProjectSelect.tsx`, change line 34 from:

```tsx
        {projects.map((project) => (
```

to:

```tsx
        {[...projects].sort((a, b) => a.name.localeCompare(b.name)).map((project) => (
```

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/apps/app/src/renderer/src/App.tsx packages/domains/projects/src/client/ProjectSelect.tsx
git commit -m "feat: wire up project reorder to App and keep ProjectSelect alphabetical"
```

---

### Task 9: Manual Testing & Verification

- [ ] **Step 1: Run full typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 2: Run handler tests**

Run: `npx tsx packages/domains/projects/src/main/handlers.test.ts`
Expected: All PASS

- [ ] **Step 3: Manual test in the app**

1. Launch the app (user handles this)
2. Verify projects appear in sidebar
3. Drag a project blob up/down — verify others shift
4. Release — verify new order persists after reload
5. Create a new project — verify it appears at the bottom
6. Open ProjectSelect dropdown — verify it's still alphabetical

- [ ] **Step 4: Commit any fixes if needed**
