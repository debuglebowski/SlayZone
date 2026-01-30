# Tags Domain (Main)

Tag CRUD and task-tag associations.

## Responsibilities

- Tag persistence (create, read, update, delete)
- Task-tag relationship management

## IPC Handlers

| Channel | Purpose |
|---------|---------|
| `db:tags:*` | Tag CRUD |
| `db:taskTags:getForTask` | Get tags for a task |
| `db:taskTags:setForTask` | Set tags for a task (replaces all) |

## Types

```typescript
import type { Tag, CreateTagInput, UpdateTagInput } from '@shared/domains/tag'
```

## Dependencies

- `../../db` - SQLite database access
