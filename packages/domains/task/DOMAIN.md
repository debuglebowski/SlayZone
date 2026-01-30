# Task Domain

Task CRUD operations, detail view, and AI-powered description generation.

## Contracts (shared/)

```typescript
interface Task {
  id: string
  project_id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: number
  terminal_mode: TerminalMode
  // ... terminal config, timestamps
}

type TaskStatus = 'inbox' | 'backlog' | 'todo' | 'in_progress' | 'review' | 'done'
```

Also exports validation schemas (`createTaskSchema`, `updateTaskSchema`) and form types.

## Main Process (main/)

- `registerTaskHandlers(ipcMain, db)` - Task CRUD, archive, reorder
- `registerAiHandlers(ipcMain)` - AI description generation
- `registerFilesHandlers(ipcMain)` - Temp image saving for AI

## Client (client/)

- `TaskDetailPage` - Full task view with terminal
- `CreateTaskDialog` / `EditTaskDialog` / `DeleteTaskDialog`
- `QuickRunDialog` - Quick task execution
- `TaskMetadataSidebar` - Priority, status, project, tags, blockers

## Dependencies

- `@omgslayzone/terminal` - TerminalMode type, Terminal component
- `@omgslayzone/projects` - Project selector
- `@omgslayzone/editor` - Rich text description
