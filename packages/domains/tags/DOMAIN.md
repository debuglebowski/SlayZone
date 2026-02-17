# Tags Domain

Task tagging system for categorization.

## Contracts (shared/)

```typescript
interface Tag {
  id: string
  name: string
  color: string
  created_at: string
}
```

## Main Process (main/)

- `registerTagHandlers(ipcMain, db)` - Tag CRUD
- `registerTaskTagHandlers(ipcMain, db)` - Task-tag associations

## Dependencies

None.
