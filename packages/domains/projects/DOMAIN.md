# Projects Domain

Project management - containers for tasks with color coding and filesystem path.

## Contracts (shared/)

```typescript
interface Project {
  id: string
  name: string
  color: string      // Hex color
  path: string | null // Filesystem path for terminal cwd
  created_at: string
  updated_at: string
}
```

## Main Process (main/)

- `registerProjectHandlers(ipcMain, db)` - Project CRUD

## Client (client/)

- `CreateProjectDialog` / `ProjectSettingsDialog` / `DeleteProjectDialog`
- `ProjectSelect` - Dropdown selector

## Dependencies

None.
