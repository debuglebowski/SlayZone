---
phase: 10-task-lifecycle
plan: 02
subsystem: ui
tags: [react, dropdown, archive, navigation]

# Dependency graph
requires:
  - phase: 10-task-lifecycle
    plan: 01
    provides: Archive backend (archiveTask, unarchiveTask, getArchivedTasks)
provides:
  - Archive/Delete dropdown on TaskDetailPage
  - ArchivedTasksView component
  - Archive sidebar navigation
affects: [10-task-lifecycle plans 03-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Action dropdown in header for task operations
    - Sidebar icon button for archive navigation

key-files:
  created:
    - src/renderer/src/components/ArchivedTasksView.tsx
  modified:
    - src/renderer/src/components/task-detail/TaskDetailPage.tsx
    - src/renderer/src/components/sidebar/AppSidebar.tsx
    - src/renderer/src/App.tsx

key-decisions:
  - "Action dropdown (MoreHorizontal icon) for Archive/Delete"
  - "Archive icon button in sidebar between All and projects"
  - "Archived view is full-screen like task detail (no sidebar)"

patterns-established:
  - "Action dropdown pattern for destructive task operations"

# Metrics
duration: 4min
completed: 2026-01-17
---

# Phase 10 Plan 02: Archive UI Summary

**Action dropdown on TaskDetailPage with Archive/Delete; ArchivedTasksView accessible via sidebar icon**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-17T15:49:58Z
- **Completed:** 2026-01-17T15:54:00Z
- **Tasks:** 3
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- TaskDetailPage header has ... dropdown with Archive and Delete options
- Delete option opens existing DeleteTaskDialog for confirmation
- Archive action calls backend and returns to kanban
- New ArchivedTasksView shows archived tasks with project dots and dates
- Unarchive button (Undo2 icon) appears on hover in archived list
- Sidebar has Archive button between All and project list

## Task Commits

Each task was committed atomically:

1. **Task 1: Add action dropdown to TaskDetailPage** - `ca64888` (feat)
2. **Task 2: Create ArchivedTasksView component** - `1adeebc` (feat)
3. **Task 3: Add Archive nav to sidebar and wire App** - `b725ca1` (feat)

## Files Created/Modified
- `src/renderer/src/components/task-detail/TaskDetailPage.tsx` - Action dropdown with Archive/Delete
- `src/renderer/src/components/ArchivedTasksView.tsx` - New component for archived task list
- `src/renderer/src/components/sidebar/AppSidebar.tsx` - Archive button added
- `src/renderer/src/App.tsx` - Archived view state and routing

## Decisions Made
- Action dropdown uses MoreHorizontal icon (common pattern)
- Archive button uses Archive icon (lucide-react)
- Unarchive uses Undo2 icon (suggests "restore")
- Archived view is full-screen (consistent with task detail)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Full archive/unarchive/delete UI flow complete
- Ready for Plan 03: Delete confirmation enhancement (if planned)
- Ready for Plan 04: Additional lifecycle features

---
*Phase: 10-task-lifecycle*
*Completed: 2026-01-17*
