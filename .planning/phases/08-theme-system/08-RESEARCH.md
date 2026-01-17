# Phase 8: Theme System - Research

**Researched:** 2026-01-17
**Domain:** Electron theme management with React + Tailwind CSS v4
**Confidence:** HIGH

## Summary

The app already has complete CSS infrastructure for dark mode - CSS variables in `main.css` with `:root` (light) and `.dark` (dark) variants, plus Tailwind v4's `@custom-variant dark` directive. The implementation needs:

1. **Main process**: Use Electron's `nativeTheme` API to control OS-level theme and persist user preference
2. **Renderer**: Add ThemeProvider context to manage/expose theme state, add UI toggle in settings
3. **IPC bridge**: Expose nativeTheme control + system preference detection to renderer

**Primary recommendation:** Use Electron's `nativeTheme.themeSource` as the source of truth. It automatically syncs with `prefers-color-scheme` CSS queries AND controls OS-level UI (menus, devtools). Combine with class-based Tailwind dark mode for full control.

## Standard Stack

### Core

| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| Electron nativeTheme | Built-in | Theme source control | Official API, controls OS UI + CSS queries |
| React Context | Built-in | Theme state distribution | Standard React pattern |
| CSS Variables | Built-in | Color theming | Already implemented in main.css |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| N/A | - | - | No additional libraries needed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| nativeTheme | matchMedia only | Loses native UI sync (menus, devtools, context menus) |
| Class toggle | prefers-color-scheme only | No manual override capability |

**No installation needed** - all required APIs are built-in.

## Architecture Patterns

### Recommended Data Flow

```
User selects theme (light/dark/system)
         |
         v
IPC to main process
         |
         v
Main: nativeTheme.themeSource = 'light' | 'dark' | 'system'
         |
         v
Main: Persist to SQLite settings table
         |
         v
nativeTheme.shouldUseDarkColors updates
         |
         v
IPC event 'theme:changed' to renderer
         |
         v
Renderer: Toggle .dark class on <html>
```

### Project Structure (new files only)

```
src/
├── main/
│   └── ipc/
│       └── theme.ts           # nativeTheme handlers + system listener
├── preload/
│   └── index.ts               # Add theme API to bridge (MODIFY)
├── renderer/src/
│   ├── contexts/
│   │   └── ThemeContext.tsx   # ThemeProvider + useTheme hook
│   └── components/
│       └── dialogs/
│           └── UserSettingsDialog.tsx  # Add theme toggle (MODIFY)
└── shared/types/
    └── api.ts                 # Add theme types (MODIFY)
```

### Pattern 1: nativeTheme as Source of Truth

**What:** Electron's nativeTheme controls both OS UI theming AND CSS `prefers-color-scheme` queries.

**When to use:** Always - this is the correct pattern for Electron apps.

**Why:** Setting `nativeTheme.themeSource = 'dark'` automatically:
- Makes `shouldUseDarkColors` return true
- Updates context menus, devtools, native dialogs to dark
- Makes CSS `prefers-color-scheme: dark` match
- On macOS, updates window chrome and system menus

```typescript
// src/main/ipc/theme.ts
import { nativeTheme, ipcMain, BrowserWindow } from 'electron'

export function registerThemeHandlers(): void {
  // Get current effective theme (what's actually showing)
  ipcMain.handle('theme:get-effective', () => {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  })

  // Get user's preference (light/dark/system)
  ipcMain.handle('theme:get-source', () => {
    return nativeTheme.themeSource
  })

  // Set theme preference
  ipcMain.handle('theme:set', (_, theme: 'light' | 'dark' | 'system') => {
    nativeTheme.themeSource = theme
    // Return the effective theme after change
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  })

  // Listen for OS theme changes (only matters when themeSource is 'system')
  nativeTheme.on('updated', () => {
    const effectiveTheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
    // Notify all windows
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('theme:changed', effectiveTheme)
    })
  })
}
```

### Pattern 2: ThemeContext with useTheme Hook

**What:** React context provides theme state and toggle function to all components.

**When to use:** For any component needing theme info or toggle capability.

```typescript
// src/renderer/src/contexts/ThemeContext.tsx
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

type Theme = 'light' | 'dark'
type ThemePreference = 'light' | 'dark' | 'system'

interface ThemeContextValue {
  theme: Theme              // Current effective theme
  preference: ThemePreference  // User's preference
  setPreference: (pref: ThemePreference) => Promise<void>
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')
  const [preference, setPreferenceState] = useState<ThemePreference>('system')

  // Initialize from main process
  useEffect(() => {
    Promise.all([
      window.api.theme.getEffective(),
      window.api.theme.getSource()
    ]).then(([effective, source]) => {
      setTheme(effective)
      setPreferenceState(source)
    })

    // Listen for system theme changes
    const unsubscribe = window.api.theme.onChange((newTheme) => {
      setTheme(newTheme)
    })
    return unsubscribe
  }, [])

  // Apply dark class to <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  const setPreference = async (pref: ThemePreference) => {
    const effective = await window.api.theme.set(pref)
    setPreferenceState(pref)
    setTheme(effective)
  }

  return (
    <ThemeContext.Provider value={{ theme, preference, setPreference }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
```

### Pattern 3: Theme Toggle UI Component

**What:** Simple segmented control or dropdown for light/dark/system selection.

**When to use:** In UserSettingsDialog.

```typescript
// In UserSettingsDialog.tsx
const { preference, setPreference } = useTheme()

<div className="flex items-center justify-between">
  <Label>Theme</Label>
  <Select value={preference} onValueChange={setPreference}>
    <SelectTrigger className="w-32">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="light">Light</SelectItem>
      <SelectItem value="dark">Dark</SelectItem>
      <SelectItem value="system">System</SelectItem>
    </SelectContent>
  </Select>
</div>
```

### Anti-Patterns to Avoid

- **Don't use localStorage for persistence in Electron** - Use SQLite settings table (already exists)
- **Don't use matchMedia directly for system detection** - nativeTheme handles this
- **Don't forget to sync class on initial load** - Can cause flash of wrong theme
- **Don't put theme script in HTML head** - This is for SSR apps; Electron doesn't need it

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| System theme detection | matchMedia listener | nativeTheme.shouldUseDarkColors | Electron API is authoritative |
| Theme persistence | localStorage wrapper | Existing settings table | Already have SQLite settings |
| CSS variable switching | JS manipulation | .dark class toggle | CSS already handles it |
| OS UI theming | Custom solution | nativeTheme.themeSource | Only way to theme native UI |

**Key insight:** Electron's nativeTheme API does the heavy lifting. The implementation is mostly wiring.

## Common Pitfalls

### Pitfall 1: Flash of Wrong Theme (FOUC)

**What goes wrong:** App briefly shows light theme before dark class is applied.

**Why it happens:** React mounts, renders with default theme, then effect applies correct theme.

**How to avoid:**
1. Load persisted preference in main process BEFORE creating window
2. Set nativeTheme.themeSource before window loads
3. Renderer just reads initial state, no flash

**Warning signs:** Brief white flash when app starts in dark mode.

### Pitfall 2: Forgetting System Theme Changes

**What goes wrong:** User sets "system", changes OS theme, app doesn't update.

**Why it happens:** Missing nativeTheme 'updated' event listener.

**How to avoid:** Always listen to nativeTheme.on('updated') and broadcast to renderer.

**Warning signs:** Manual light/dark work, but "system" doesn't follow OS changes.

### Pitfall 3: Class Toggle Without nativeTheme

**What goes wrong:** App shows dark theme but context menus, devtools show light.

**Why it happens:** Only toggling .dark class, not setting nativeTheme.themeSource.

**How to avoid:** Always use nativeTheme.themeSource as the source of truth.

**Warning signs:** Inconsistent theming between app content and Electron chrome.

### Pitfall 4: Settings Not Persisting Across Restarts

**What goes wrong:** Theme resets to system/light on app restart.

**Why it happens:** Not loading persisted preference in main process on startup.

**How to avoid:** In main process startup, read settings and set nativeTheme.themeSource BEFORE creating BrowserWindow.

**Warning signs:** Theme correct during session, wrong on restart.

## Code Examples

### IPC Handler Registration (main process)

```typescript
// src/main/ipc/theme.ts
import { nativeTheme, ipcMain, BrowserWindow } from 'electron'
import { getDatabase } from '../db'

export function registerThemeHandlers(): void {
  const db = getDatabase()

  ipcMain.handle('theme:get-effective', () => {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  })

  ipcMain.handle('theme:get-source', () => {
    return nativeTheme.themeSource
  })

  ipcMain.handle('theme:set', (_, theme: 'light' | 'dark' | 'system') => {
    nativeTheme.themeSource = theme
    // Persist to database
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
      .run('theme', theme)
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  })

  nativeTheme.on('updated', () => {
    const effective = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('theme:changed', effective)
    })
  })
}
```

### Preload API Extension

```typescript
// Add to src/preload/index.ts
theme: {
  getEffective: () => ipcRenderer.invoke('theme:get-effective'),
  getSource: () => ipcRenderer.invoke('theme:get-source'),
  set: (theme: 'light' | 'dark' | 'system') => ipcRenderer.invoke('theme:set', theme),
  onChange: (callback: (theme: 'light' | 'dark') => void) => {
    const handler = (_event: unknown, theme: 'light' | 'dark') => callback(theme)
    ipcRenderer.on('theme:changed', handler)
    return () => ipcRenderer.removeListener('theme:changed', handler)
  }
}
```

### Startup Theme Initialization (main process)

```typescript
// In src/main/index.ts, before createWindow()
import { nativeTheme } from 'electron'
import { getDatabase } from './db'

app.whenReady().then(() => {
  const db = getDatabase()

  // Load and apply persisted theme BEFORE creating window
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('theme') as { value: string } | undefined
  const savedTheme = row?.value as 'light' | 'dark' | 'system' | undefined
  if (savedTheme) {
    nativeTheme.themeSource = savedTheme
  }

  // Then register handlers and create window
  registerThemeHandlers()
  registerDatabaseHandlers()
  createWindow()
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| prefers-color-scheme only | nativeTheme.themeSource | Electron 7.0 | Full control over theme |
| localStorage persistence | SQLite/electron-store | Best practice | Survives cache clears |
| matchMedia listeners | nativeTheme.on('updated') | Electron 7.0 | Simpler, authoritative |

**Current in Electron 39:** All nativeTheme APIs stable, no deprecations.

## Open Questions

None significant. The architecture is well-established.

Minor considerations:
1. **Icon tray theming** - If app adds tray icon later, may need theme-aware icons
2. **Print styling** - Dark mode shouldn't affect print (handled by CSS @media print)

## Sources

### Primary (HIGH confidence)
- [Electron nativeTheme API](https://www.electronjs.org/docs/latest/api/native-theme) - Official docs
- [Electron Dark Mode Tutorial](https://www.electronjs.org/docs/latest/tutorial/dark-mode) - Official guide
- [Tailwind CSS v4 Dark Mode](https://tailwindcss.com/docs/dark-mode) - Official docs

### Secondary (MEDIUM confidence)
- WebSearch verified patterns for React ThemeContext implementation

### Tertiary (LOW confidence)
- None relied upon

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using official Electron APIs, existing Tailwind setup
- Architecture: HIGH - Well-documented patterns, matches existing app structure
- Pitfalls: HIGH - Documented in official Electron tutorials

**Research date:** 2026-01-17
**Valid until:** 90 days (stable APIs, no breaking changes expected)
