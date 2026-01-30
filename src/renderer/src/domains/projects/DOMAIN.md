# Projects Domain (Renderer)

Project CRUD dialogs and selection.

## Responsibilities

- Create/Edit/Delete project dialogs
- Project selector dropdown
- Project settings (path, color)

## Exports

| Export | Type | Purpose |
|--------|------|---------|
| `CreateProjectDialog` | Component | New project modal |
| `ProjectSettingsDialog` | Component | Edit project modal |
| `DeleteProjectDialog` | Component | Delete confirmation |
| `ProjectSelect` | Component | Project dropdown |

## Key Files

| File | Purpose |
|------|---------|
| `components/ProjectSelect.tsx` | Sidebar project picker |
| `components/CreateProjectDialog.tsx` | Create form with path picker |

## Dependencies

- `window.api.dialog` - Folder picker
