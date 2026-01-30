# Settings Domain

User preferences and theme management.

## Contracts (shared/)

```typescript
type Theme = 'light' | 'dark'
type ThemePreference = 'light' | 'dark' | 'system'
```

## Main Process (main/)

- `registerSettingsHandlers(ipcMain, db)` - Key-value settings store
- `registerThemeHandlers(ipcMain)` - Theme with system preference detection

## Client (client/)

- `ThemeProvider` / `useTheme()` - Theme context
- `UserSettingsDialog` - Settings panel
- `useViewState` - View preferences (sidebar collapsed, etc.)

## Dependencies

None.
