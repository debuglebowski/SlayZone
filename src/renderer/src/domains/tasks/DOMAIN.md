# Tasks Domain (Renderer)

Multi-task views: kanban board, filters, grouping, archived view.

## Responsibilities

- Kanban board with drag-and-drop
- Task filtering by status, priority, tags, search
- Grouping by status/priority/due date
- Task list view (alternative to kanban)
- Archived tasks view

## Exports

| Export | Type | Purpose |
|--------|------|---------|
| `KanbanBoard` | Component | Main drag-drop kanban |
| `FilterBar` | Component | Filter controls |
| `useTasksData` | Hook | Central data state |
| `useFilterState` | Hook | Filter state management |
| `applyFilters` | Function | Filter logic |
| `Column`, `GroupKey` | Types | Kanban types |

## Key Files

| File | Purpose |
|------|---------|
| `hooks/useTasksData.ts` | Tasks, projects, tags state + mutations |
| `hooks/useFilterState.ts` | Filter state persistence |
| `components/KanbanBoard.tsx` | dnd-kit kanban container |
| `components/KanbanColumn.tsx` | Individual column |
| `components/KanbanCard.tsx` | Task card with context menu |
| `lib/kanban.ts` | Grouping/filtering utilities |

## Dependencies

- `@dnd-kit/core` - Drag and drop
- `../task` - Task dialogs
- `../terminal` - PTY status for cards
