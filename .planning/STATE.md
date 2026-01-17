# Project State

## Project Reference

See: .planning/PROJECT.md

**Core value:** One place for all tasks with focused Work Mode that prevents rabbit-holing
**Current focus:** Phase 7 - Polish + UX (in progress)

## Current Position

Phase: 7 of 7 (Polish + UX)
Plan: 3 of 5 complete (07-01, 07-03, 07-04)
Status: In progress
Last activity: 2026-01-17 - Completed 07-01-PLAN.md (Tags in CreateTaskDialog)

Progress: █████████████████████████████████░░░ 94% (29/31 plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 29
- Average duration: 2.7min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 3 | 19min | 6.3min |
| 02-data-layer | 3 | 13min | 4.3min |
| 03-navigation | 5 | 11min | 2.2min |
| 04-task-management | 7 | 14min | 2.0min |
| 05-ai-integration | 4 | 7min | 1.8min |
| 06-work-mode | 5 | 12min | 2.4min |
| 07-polish | 3 | 21min | 7.0min |

## Accumulated Context

### Decisions

| Decision | Phase | Rationale |
|----------|-------|-----------|
| shadcn new-york style, neutral color | 01-01 | Default, changeable later |
| @ alias in root tsconfig.json | 01-01 | Required for shadcn CLI compatibility |
| WAL mode for SQLite | 01-02 | Better concurrent performance |
| Separate dev/prod database files | 01-02 | Avoid accidental data loss |
| user_version pragma for migrations | 01-02 | Simpler than migration table |
| IPC channel naming: db:entity:action | 01-03 | Consistent, discoverable |
| Explicit security settings | 01-03 | Don't rely on defaults for security |
| Dynamic SET clause for partial updates | 02-01 | Only modify provided fields |
| Update returns entity, delete returns boolean | 02-01 | Consistent return patterns |
| Zod enum mirrors database.ts TaskStatus | 02-02 | Validation matches DB schema |
| Priority as number 1-5, not string | 02-02 | Enables sorting |
| dueDate as nullable ISO string | 02-02 | Consistent date format |
| Explicit form data types vs Zod inferred | 02-03 | Form compatibility with react-hook-form |
| Collapsible blockedReason field | 02-03 | Cleaner edit dialog UX |
| Null-to-undefined coercion for API calls | 02-03 | Form uses null, API expects undefined |
| Tags use UNIQUE name constraint | 03-02 | Prevent duplicate tag names |
| Settings use INSERT OR REPLACE | 03-02 | Simple upsert behavior |
| Tags and settings as separate API namespaces | 03-02 | Cleaner organization |
| Start with All view (null selectedProjectId) | 03-03 | Better UX for cross-project tasks |
| Fixed 64px sidebar, non-collapsible | 03-03 | Simple sidebar for nav phase |
| 2-letter abbreviation from project name | 03-03 | Compact blob display |
| Client-side cascade delete for project tasks | 03-04 | DB handles FK cascade, state updated locally |
| Native color input for tag colors | 03-05 | Simpler than ColorPicker component |
| Settings in SidebarFooter | 03-05 | Clear separation from project nav |
| Database path read-only in UI | 03-05 | Change requires CLI restart |
| taskTags as separate API namespace | 04-01 | Consistent with tags/settings pattern |
| setTagsForTask delete-all + insert | 04-01 | Simple, atomic transaction |
| Only status grouping enables drag-drop | 04-02 | Priority/due_date columns read-only |
| Root tasks only in kanban | 04-02 | Subtasks filtered by parent_id |
| DndContext with DragOverlay pattern | 04-02 | Smooth drag preview rendering |
| Filter key per project: filter:${projectId} | 04-03 | Per-project filter persistence |
| 500ms debounce on filter save | 04-03 | Avoid excessive SQLite writes |
| isLoaded flag from useFilterState | 04-03 | Prevent flash of default state |
| ViewState discriminated union for nav | 04-05 | State-based routing without router |
| Wrap ReactMarkdown in div for prose | 04-05 | v10 API doesn't accept className |
| Click-to-edit with blur-to-save | 04-05 | Inline editing pattern |
| Drag disable via useSortable disabled option | 04-04 | Native dnd-kit support |
| Project lookup via Map prop | 04-04 | O(1) lookup, single source of truth |
| Subtask status: checkbox toggles todo/done | 04-06 | Simplified from full status |
| Local state for subtasks (no refetch) | 04-06 | Simpler mutation handling |
| readline for NDJSON parsing | 05-01 | Handles partial chunks correctly |
| Single active Claude process | 05-01 | Simpler cancel logic, prevents resource exhaustion |
| handle() for stream start, on() for cancel | 05-02 | Renderer awaits start, cancel is fire-and-forget |
| Preload callbacks return cleanup functions | 05-02 | Proper listener removal pattern |
| useReducer for streaming state | 05-03 | Predictable state transitions |
| Optimistic user message display | 05-03 | Immediate feedback before persistence |
| workspaceItems API follows chatMessages pattern | 06-01 | Consistent namespace organization |
| WorkModePage back returns to task-detail | 06-02 | Better UX flow, not always return to kanban |
| onWorkMode prop optional | 06-02 | Support potential standalone usage |
| Inline rename via input on context menu | 06-03 | Blur-to-save pattern from click-to-edit |
| Add item via dropdown (chat/browser/document) | 06-03 | Single + button with type options |
| persist:browser-tabs partition for webview | 06-04 | Session sharing across browser tabs |
| Conditional rendering by activeItem.type | 06-04 | Clean content switching in WorkModePage |
| WorkspaceItemCard for sidebar items | 06-05 | Provides rename/delete via dropdown menu |
| onboarding_completed setting as boolean flag | 07-04 | Simple first-run detection |
| showCloseButton={false} on onboarding dialog | 07-04 | Force completion or explicit skip |
| Priority score formula: (6-priority)*200 + dueDateScore + statusScore | 07-03 | Clear weighted scoring |
| Overdue tasks capped at +1000 bonus | 07-03 | Prevent runaway scores |
| Remove .default([]) from tagIds schema | 07-01 | react-hook-form type compatibility |

### Pending Todos

(None yet)

### Blockers/Concerns

(None yet)

## Session Continuity

Last session: 2026-01-17T14:00Z
Stopped at: Completed 07-01-PLAN.md (Tags in CreateTaskDialog)
Resume file: None
