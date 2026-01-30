# Settings Domain (Renderer)

Theme management and user preferences UI.

## Responsibilities

- Theme context (light/dark/system)
- User settings dialog
- View state persistence (sidebar, grouping)

## Exports

| Export | Type | Purpose |
|--------|------|---------|
| `UserSettingsDialog` | Component | Settings modal |
| `ThemeProvider` | Context | Theme state |
| `useTheme` | Hook | Access theme context |
| `useViewState` | Hook | Persisted view preferences |

## Key Files

| File | Purpose |
|------|---------|
| `context/ThemeContext.tsx` | Theme state, system sync |
| `components/UserSettingsDialog.tsx` | Settings form |
| `hooks/useViewState.ts` | Sidebar/grouping persistence |

## Theme System

- Preference: `light` | `dark` | `system`
- Effective: `light` | `dark` (resolved from preference)
- Syncs with `window.api.theme` and system theme changes

## Dependencies

- `window.api.theme` - IPC to main for theme persistence
- `window.api.settings` - Generic settings storage
