# Phase 12: Settings Redesign - Research

**Researched:** 2026-01-17
**Domain:** Professional settings UI with CLI status detection
**Confidence:** HIGH

## Summary

The current UserSettingsDialog is a single-scroll dialog with Appearance, Tags, and Database sections. Requirements call for:
1. **Professional, polished layout** - Reorganize with tabbed navigation for better UX
2. **Claude Code CLI status** - Show availability status using `which` package (already in deps)

The codebase uses shadcn/ui components built on Radix UI. Adding Tabs component requires `npx shadcn@latest add tabs` which installs `@radix-ui/react-tabs`. CLI detection should happen in main process using child_process spawn (already exists for Claude streaming).

**Primary recommendation:** Use shadcn/ui Tabs component with sections: General (theme), Tags, About (database path + Claude Code status). Check CLI availability via main process IPC handler using `which` package.

## Standard Stack

### Core

| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| shadcn/ui Tabs | Latest | Tabbed settings layout | Consistent with existing UI components |
| @radix-ui/react-tabs | 1.x | Underlying tabs primitive | Accessible, headless |
| which | 5.0.0 | CLI detection | Already in deps via electron-rebuild |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| child_process | Built-in | CLI version check | Get Claude version string |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Tabs | Accordion | Tabs better for distinct sections, more professional |
| Tabs | Vertical nav | Overkill for 3-4 sections |
| which package | Manual spawn | which handles cross-platform edge cases |

**Installation:**
```bash
npx shadcn@latest add tabs
```

## Architecture Patterns

### Recommended Settings Structure

```
Settings Dialog (wider, ~600px)
├── DialogHeader: "Settings"
├── Tabs
│   ├── TabsList (horizontal)
│   │   ├── TabsTrigger "General"
│   │   ├── TabsTrigger "Tags"
│   │   └── TabsTrigger "About"
│   ├── TabsContent "General"
│   │   ├── Theme section (existing)
│   │   └── [future settings]
│   ├── TabsContent "Tags"
│   │   └── Tag management (existing)
│   └── TabsContent "About"
│       ├── Database path (existing)
│       └── Claude Code status (NEW)
```

### Pattern 1: CLI Status Check via IPC

**What:** Main process checks CLI availability, renderer displays status.

**When to use:** Anything requiring shell/PATH access.

```typescript
// src/main/ipc/claude.ts - add handler
import { spawn } from 'child_process'

ipcMain.handle('claude:check-availability', async () => {
  return new Promise((resolve) => {
    const proc = spawn('which', ['claude'])
    let path = ''

    proc.stdout?.on('data', (data) => {
      path += data.toString().trim()
    })

    proc.on('close', (code) => {
      if (code === 0 && path) {
        // Get version
        const versionProc = spawn('claude', ['--version'])
        let version = ''

        versionProc.stdout?.on('data', (data) => {
          version += data.toString().trim()
        })

        versionProc.on('close', () => {
          resolve({ available: true, path, version })
        })
      } else {
        resolve({ available: false, path: null, version: null })
      }
    })

    proc.on('error', () => {
      resolve({ available: false, path: null, version: null })
    })
  })
})
```

### Pattern 2: Tabbed Settings Dialog

**What:** Tabs for organizing settings into logical groups.

**When to use:** Settings dialogs with 3+ distinct sections.

```typescript
// UserSettingsDialog.tsx structure
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

<DialogContent className="max-w-xl">
  <DialogHeader>
    <DialogTitle>Settings</DialogTitle>
  </DialogHeader>

  <Tabs defaultValue="general" className="w-full">
    <TabsList className="grid w-full grid-cols-3">
      <TabsTrigger value="general">General</TabsTrigger>
      <TabsTrigger value="tags">Tags</TabsTrigger>
      <TabsTrigger value="about">About</TabsTrigger>
    </TabsList>

    <TabsContent value="general" className="space-y-4 pt-4">
      {/* Theme section */}
    </TabsContent>

    <TabsContent value="tags" className="space-y-4 pt-4">
      {/* Tags management */}
    </TabsContent>

    <TabsContent value="about" className="space-y-4 pt-4">
      {/* Database + Claude status */}
    </TabsContent>
  </Tabs>
</DialogContent>
```

### Pattern 3: Status Badge Component

**What:** Visual indicator for CLI availability.

```typescript
// Claude Code status display
interface ClaudeStatus {
  available: boolean
  path: string | null
  version: string | null
}

function ClaudeCodeStatus({ status }: { status: ClaudeStatus | null }) {
  if (!status) return <Skeleton className="h-4 w-32" />

  return (
    <div className="flex items-center gap-2">
      <div className={cn(
        "size-2 rounded-full",
        status.available ? "bg-green-500" : "bg-red-500"
      )} />
      <span className="text-sm">
        {status.available
          ? `Claude Code ${status.version}`
          : "Not installed"}
      </span>
    </div>
  )
}
```

### Anti-Patterns to Avoid

- **Don't check CLI availability in renderer** - No shell access, use IPC
- **Don't use synchronous spawn** - Blocks main process
- **Don't hardcode CLI path** - Use which for cross-platform
- **Don't check availability on every dialog open** - Cache result, refresh on demand

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tab navigation | Custom state + buttons | shadcn/ui Tabs | Accessibility, keyboard nav |
| CLI path detection | Manual spawn with which | which npm package | Cross-platform edge cases |
| Async shell exec | Callback hell | Promise wrapper | Cleaner code |

**Key insight:** The `which` package is already in the dependency tree. CLI status is a one-time check that can be cached.

## Common Pitfalls

### Pitfall 1: PATH Not Available in Packaged App

**What goes wrong:** CLI found in dev, not found in production.

**Why it happens:** Packaged Electron apps have different PATH than development.

**How to avoid:**
1. Use full PATH from environment
2. Test in packaged app
3. Provide helpful error message with install instructions

**Warning signs:** Works in `npm run dev`, fails in packaged DMG.

### Pitfall 2: Slow Dialog Open

**What goes wrong:** Settings dialog feels sluggish.

**Why it happens:** Checking CLI availability synchronously on every open.

**How to avoid:**
1. Check once on app startup
2. Store result in state
3. Add manual refresh button

**Warning signs:** Noticeable delay when clicking Settings.

### Pitfall 3: Tab Content Not Preserving State

**What goes wrong:** Form inputs reset when switching tabs.

**Why it happens:** TabsContent unmounts by default.

**How to avoid:** Radix Tabs keeps content mounted - ensure state is lifted to parent or managed per-tab.

**Warning signs:** Editing tag name, switching tabs, losing edit.

### Pitfall 4: Dialog Too Narrow for Tabs

**What goes wrong:** Tabs wrap or look cramped.

**Why it happens:** Using default max-w-lg (~512px).

**How to avoid:** Use max-w-xl (~576px) or max-w-2xl (~672px) for tabbed dialogs.

**Warning signs:** TabsList wraps to multiple lines.

## Code Examples

### Tabs Component Installation

```bash
npx shadcn@latest add tabs
```

This creates `src/renderer/src/components/ui/tabs.tsx`.

### IPC Handler for CLI Check

```typescript
// src/main/ipc/claude.ts
import { ipcMain } from 'electron'
import { spawn } from 'child_process'

interface ClaudeAvailability {
  available: boolean
  path: string | null
  version: string | null
}

export function registerClaudeAvailabilityHandler(): void {
  ipcMain.handle('claude:check-availability', async (): Promise<ClaudeAvailability> => {
    return new Promise((resolve) => {
      // Use which on Unix, where on Windows
      const cmd = process.platform === 'win32' ? 'where' : 'which'
      const proc = spawn(cmd, ['claude'], { shell: true })

      let path = ''
      proc.stdout?.on('data', (data) => {
        path += data.toString().trim()
      })

      proc.on('close', (code) => {
        if (code !== 0 || !path) {
          resolve({ available: false, path: null, version: null })
          return
        }

        // Get version
        const versionProc = spawn('claude', ['--version'])
        let version = ''

        versionProc.stdout?.on('data', (data) => {
          version += data.toString().trim()
        })

        versionProc.on('close', () => {
          resolve({
            available: true,
            path: path.split('\n')[0], // First line only
            version: version || 'unknown'
          })
        })

        versionProc.on('error', () => {
          resolve({ available: true, path, version: 'unknown' })
        })
      })

      proc.on('error', () => {
        resolve({ available: false, path: null, version: null })
      })
    })
  })
}
```

### Preload API Extension

```typescript
// Add to src/preload/index.ts
claude: {
  // ... existing methods
  checkAvailability: () => ipcRenderer.invoke('claude:check-availability')
}
```

### Type Definitions

```typescript
// Add to src/shared/types/api.ts
export interface ClaudeAvailability {
  available: boolean
  path: string | null
  version: string | null
}

// In ElectronAPI.claude
checkAvailability: () => Promise<ClaudeAvailability>
```

### Settings Dialog Refactored Structure

```typescript
// UserSettingsDialog.tsx key structure
export function UserSettingsDialog({ open, onOpenChange }: UserSettingsDialogProps) {
  const { preference, setPreference } = useTheme()
  const [tags, setTags] = useState<Tag[]>([])
  const [claudeStatus, setClaudeStatus] = useState<ClaudeAvailability | null>(null)
  // ... other state

  useEffect(() => {
    if (open) {
      loadData()
      window.api.claude.checkAvailability().then(setClaudeStatus)
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="tags">Tags</TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            {/* Theme select */}
          </TabsContent>

          <TabsContent value="tags">
            {/* Tag list + create form */}
          </TabsContent>

          <TabsContent value="about">
            {/* Database path */}
            {/* Claude Code status */}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single scroll dialog | Tabbed sections | UX best practice | Better organization |
| No CLI status | Proactive availability check | New requirement | User confidence |
| Inline forms | Dedicated tab sections | shadcn patterns | Cleaner separation |

**Current in shadcn/ui:** Tabs component is stable, uses Radix 1.x.

## Open Questions

1. **Tab persistence** - Should selected tab persist across dialog close/open?
   - Recommendation: No, reset to "General" each time. Keeps it simple.

2. **Claude status refresh** - Manual button or automatic?
   - Recommendation: Check on dialog open. Add refresh button for manual re-check.

3. **Future settings** - Room for more tabs?
   - Recommendation: Current 3-column grid works for 3-4 tabs. Can adjust later.

## Sources

### Primary (HIGH confidence)
- [shadcn/ui Tabs](https://ui.shadcn.com/docs/components/tabs) - Official component docs
- [command-exists npm](https://www.npmjs.com/package/command-exists) - CLI detection patterns
- Existing codebase: claude-spawner.ts shows spawn pattern

### Secondary (MEDIUM confidence)
- [Checking executable in PATH](https://abdus.dev/posts/checking-executable-exists-in-path-using-node/) - Cross-platform considerations
- [shadcn/ui blocks](https://www.shadcnblocks.com/components/tabs) - Layout inspiration

### Tertiary (LOW confidence)
- None relied upon

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing shadcn/ui patterns
- Architecture: HIGH - Straightforward refactor of existing component
- CLI detection: HIGH - Pattern exists in codebase, which package available

**Research date:** 2026-01-17
**Valid until:** 90 days (stable patterns, no breaking changes expected)
