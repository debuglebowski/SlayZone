# Task Domain (Renderer)

Single task detail view and CRUD dialogs.

## Responsibilities

- Task detail page with terminal and metadata
- Create/Edit/Delete task dialogs
- Quick run dialog (send prompt to active task)
- Task metadata sidebar (tags, dependencies, settings)

## Exports

| Export | Type | Purpose |
|--------|------|---------|
| `TaskDetailPage` | Component | Full task view with terminal |
| `TaskMetadataSidebar` | Component | Tags, deps, terminal config |
| `CreateTaskDialog` | Component | New task modal |
| `EditTaskDialog` | Component | Edit task modal |
| `DeleteTaskDialog` | Component | Delete confirmation |
| `QuickRunDialog` | Component | Quick prompt input |

## Key Files

| File | Purpose |
|------|---------|
| `components/TaskDetailPage.tsx` | Main task view, integrates terminal |
| `components/TaskMetadataSidebar.tsx` | Metadata panel |
| `components/CreateTaskDialog.tsx` | Create form with AI description |
| `components/QuickRunDialog.tsx` | Cmd+K prompt input |

## Dependencies

- `../terminal` - Terminal component
- `../tags` - Tag management
