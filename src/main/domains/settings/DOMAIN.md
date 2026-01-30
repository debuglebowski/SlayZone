# Settings Domain (Main)

Key-value settings and theme management.

## Responsibilities

- Generic key-value settings storage
- Theme preference persistence
- System theme detection and sync

## IPC Handlers

| Channel | Purpose |
|---------|---------|
| `db:settings:get` | Get setting by key |
| `db:settings:set` | Set setting value |
| `db:settings:getAll` | Get all settings |
| `theme:getEffective` | Get current theme (light/dark) |
| `theme:getSource` | Get preference (light/dark/system) |
| `theme:set` | Set theme preference |

## Events (to Renderer)

| Event | Purpose |
|-------|---------|
| `theme:changed` | Theme updated |

## Types

```typescript
import type { Theme, ThemePreference } from '@shared/domains/settings'
```

## Dependencies

- `../../db` - SQLite database access
- `electron.nativeTheme` - System theme detection
