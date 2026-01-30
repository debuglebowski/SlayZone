# Projects Domain (Main)

Project CRUD operations.

## Responsibilities

- Project persistence (create, read, update, delete)
- Project path management (filesystem location)

## IPC Handlers

| Channel | Purpose |
|---------|---------|
| `db:projects:getAll` | List all projects |
| `db:projects:create` | Create project |
| `db:projects:update` | Update project |
| `db:projects:delete` | Delete project |

## Types

```typescript
import type { Project, CreateProjectInput, UpdateProjectInput } from '@shared/domains/project'
```

## Dependencies

- `../../db` - SQLite database access
