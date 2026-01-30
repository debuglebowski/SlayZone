# Task Domain (Main)

Task CRUD, archiving, dependencies, AI description generation, file handling.

## Responsibilities

- Task persistence (create, read, update, delete)
- Archive/unarchive operations
- Task ordering and reordering
- Task dependency management (blockers)
- AI-powered description generation via CLI
- Temp image file handling

## IPC Handlers

| Channel | Purpose |
|---------|---------|
| `db:tasks:*` | CRUD operations |
| `db:tasks:archive/unarchive` | Archive lifecycle |
| `db:tasks:reorder` | Update task order |
| `db:taskDependencies:*` | Blocker relationships |
| `ai:generate-description` | CLI-based description gen |
| `files:saveTempImage` | Save base64 images to temp |

## Types

```typescript
import type { Task, TaskDependency, CreateTaskInput, UpdateTaskInput } from '@shared/domains/task'
```

## Dependencies

- `../../db` - SQLite database access
- External CLI: `claude` or `codex` for AI generation
