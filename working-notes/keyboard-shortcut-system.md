# Centralized Keyboard Shortcut System

## Context

Shortcuts are registered in 6+ disconnected handlers (Electron main, browser-view-manager, App.tsx, TaskDetailPage, TerminalContainer, Terminal.tsx, CodeEditor, BrowserPanel) with no centralized priority. This causes real conflicts: Cmd+S toggles settings when user wants to save, Cmd+G opens git when browser find-next is intended, web panel shortcuts clash with system keys (Cmd+H, Cmd+X, Cmd+N). The goal is a single priority-aware dispatcher that resolves conflicts based on focus context.

## Architecture: Two-Phase Dispatcher, One Registry

Two listeners on `window`, both backed by the same `ShortcutRegistry`:

1. **Capture phase** — for modifier shortcuts (`Cmd+S`, `Cmd+G`, `Ctrl+Tab`, etc.). Fires BEFORE CodeMirror/xterm see the event, so `preventDefault + stopPropagation` cleanly consumes it. Libraries never receive consumed events — no split-brain, no double-dispatch.

2. **Bubble phase** — for non-modifier shortcuts (`Escape`, bare keys). Fires AFTER component-level handlers (Radix dropdowns, popovers, search bars). If a Radix dropdown calls `stopPropagation` on Escape, our bubble listener never sees it — correct behavior. Only unhandled Escape reaches the registry (e.g., exit zen mode).

**Why two phases**: Modifier shortcuts (Cmd+S) must beat CM/xterm → capture. Non-modifier shortcuts (Escape) must lose to Radix/popovers → bubble. Same registry, same priority logic, different timing. The phase is auto-derived from the key combo: has `mod`/`ctrl`/`alt` → capture, otherwise → bubble.

Electron's main process keeps a minimal interception layer for shortcuts that MUST run there (browser view reload, passthrough gating, IPC forwarding). Everything else is forwarded to the renderer where the dispatcher handles it.

## Scope Priority Model

Replace the three scopes (`global`, `task-panel`, `terminal`) with five, each with a numeric priority:

| Scope | Priority | Active when |
|-------|----------|------------|
| `editor` | 80 | `.cm-editor` or `[contenteditable]` has focus |
| `terminal` | 80 | `.xterm` / `.xterm-helper-textarea` has focus |
| `browser` | 80 | `[data-browser-panel]` has focus (and passthrough OFF) |
| `task` | 40 | A task tab is active |
| `global` | 20 | Always |

**Resolution rule**: highest-priority active scope wins. Same-priority scopes don't overlap (only one of editor/terminal/browser can have focus).

### How this fixes conflicts

**Modifier shortcuts (capture phase — beats CM/xterm):**
- **Cmd+S**: editor scope (80) save > task scope (40) settings toggle
- **Cmd+G**: browser scope (80) find-next > task scope (40) git panel
- **Cmd+T**: terminal scope (80) new-group > task scope (40) terminal toggle
- **Cmd+F**: terminal scope (80) search vs browser scope (80) find — no conflict, can't both have focus

**Non-modifier shortcuts (bubble phase — loses to Radix/popovers):**
- **Escape with Radix dropdown open**: Radix calls `stopPropagation` → bubble listener never sees it → dropdown closes ✓
- **Escape with terminal search open**: terminal-search-close (terminal, 80) > exit-zen-explode (global, 20)
- **Escape with nothing special open**: exit-zen-explode (global, 20) fires

## How CodeMirror + xterm Plug In

### CodeMirror
- **Remove** `Mod-s` from CM keymap in `CodeEditor.tsx:115-119`
- Component registers: `useShortcutAction('editor-save', () => save(), { scope: 'editor' })`
- Capture listener handles Cmd+S when editor scope active → calls save → CM never sees event
- **Keep** Tab/Shift-Tab indent in CM keymap — not app shortcuts, just editor behavior

### xterm
- **Remove** terminal-search (`Cmd+F`) and terminal-clear (`Cmd+Shift+K`) from `attachCustomKeyEventHandler` in `Terminal.tsx:243-250`
- Component registers: `useShortcutAction('terminal-search', () => setSearchOpen(true), { scope: 'terminal' })`
- **Keep** in xterm handler: Ctrl+Tab blocking, Shift+Enter (claude-code newline), Ctrl+Shift+C/V, Cmd+Arrow scroll — terminal-internal behaviors, not app shortcuts

### Why this works
Capture phase fires before target/bubble phase. When the dispatcher consumes Cmd+S, the event never reaches CodeMirror's internal handler. CM won't try to insert 's' because it never receives the event. Same for xterm — it never sees consumed shortcuts.

### Customization just works
User rebinds Cmd+S → Cmd+Shift+S in the shortcut store. The registry resolves the new keys. No CM keymap or xterm handler to update separately — they don't handle shortcuts anymore.

## New Files

### `packages/shared/shortcuts/src/scope.ts`

```ts
export type ShortcutScope = 'global' | 'task' | 'terminal' | 'editor' | 'browser'
export const SCOPE_PRIORITY: Record<ShortcutScope, number> = {
  editor: 80, terminal: 80, browser: 80, task: 40, global: 20,
}
```

### `packages/shared/shortcuts/src/registry.ts`

```ts
type HandlerEntry = {
  id: string
  scope: ShortcutScope
  keys: string
  handler: (e: KeyboardEvent) => void
  enabled: boolean
}

class ShortcutRegistry {
  private handlers: Map<string, HandlerEntry[]>  // keyed by normalized key combo

  // Returns unsubscribe function. Supports both static IDs and dynamic keys.
  register(opts: {
    id: string
    scope: ShortcutScope
    keys: string
    handler: (e: KeyboardEvent) => void
    enabled?: boolean
  }): () => void

  // Called by the dispatcher (both phases use this same method).
  // Finds matching handlers, filters by activeScopes, picks highest priority, calls it.
  dispatch(e: KeyboardEvent, activeScopes: Set<ShortcutScope>): boolean

  // Update enabled state (for isActive toggles, conditional handlers)
  setEnabled(registrationId: symbol, enabled: boolean): void
}

export const registry = new ShortcutRegistry()

// Derive dispatch phase from key combo string.
// Has mod/ctrl/alt → capture (must beat CM/xterm).
// Plain key (escape, letters) → bubble (must lose to Radix/popovers).
export function getDispatchPhase(keys: string): 'capture' | 'bubble' {
  const parts = keys.split('+')
  return parts.some(p => p === 'mod' || p === 'ctrl' || p === 'alt') ? 'capture' : 'bubble'
}
```

- `register()` returns an unsubscribe function (React cleanup)
- `dispatch()` returns true if a handler fired (event was consumed)
- `getDispatchPhase()` is used by the init code to decide which listener should process a given event — but both call the same `dispatch()` with the same priority logic
- When multiple handlers match the same key + scope priority, the most recently registered wins (last-mounted component = innermost/most specific)

### `packages/shared/shortcuts/src/scope-tracker.ts`

```ts
class ScopeTracker {
  private focusedScope: 'editor' | 'terminal' | 'browser' | null = null
  private taskActive: boolean = false
  private browserPassthrough: Map<string, boolean> = new Map()  // per web-panel
  private focusedBrowserPanelId: string | null = null

  // Call once from shortcut-init.ts
  init(): void  // attaches focusin listener on document

  getActiveScopes(): Set<ShortcutScope>
  setTaskActive(active: boolean): void
  setBrowserPassthrough(panelId: string, enabled: boolean): void
  isBrowserPassthrough(): boolean  // true if focused browser panel has passthrough ON
}

export const scopeTracker = new ScopeTracker()
```

- `focusin` listener detects `.xterm`/`.xterm-helper-textarea` → terminal, `.cm-editor` → editor, `[data-browser-panel]` → browser
- `getActiveScopes()` always includes `global`; includes `task` when `taskActive`; includes focused component scope
- Replaces scattered `lastFocusedPanelRef` + `isTerminalFocused()` + `inCodeMirror`/`inEditor` checks in TaskDetailPage

### `packages/shared/shortcuts/src/blocked-keys.ts`

```ts
export const BLOCKED_WEB_PANEL_KEYS = new Set([
  // macOS system
  'h', 'q', 'm', 'w',
  // Native edit
  'c', 'v', 'x', 'a', 'z',
  // Global app shortcuts
  'n', 'k', 'j', 'r', ',',
  // Built-in panel toggles
  't', 'b', 'e', 'g', 's',
  // Other conflicts
  'f', 'p', 'l', 'o', 'd', 'i',
])
```

Replaces `RESERVED_PANEL_SHORTCUTS` (5 entries) in `panel-config.ts:44`.

### `packages/shared/ui/src/useShortcutAction.ts`

```ts
// Mode 1: Static shortcut from definitions
export function useShortcutAction(
  id: string,
  handler: () => void,
  options?: { enabled?: boolean }
): void

// Mode 2: Dynamic shortcut (web panels, etc.)
export function useShortcutAction(
  opts: { id: string; keys: string; scope: ShortcutScope },
  handler: () => void,
  options?: { enabled?: boolean }
): void
```

- Mode 1: Looks up scope from `shortcutDefinitions`, keys from `useShortcutStore.getKeys(id)`
- Mode 2: Uses explicit keys+scope (for dynamic web panel shortcuts like `mod+y` for Figma)
- Calls `registry.register()` on mount, unsubscribe on unmount
- Re-registers when `enabled` or keys change
- Replaces `useGuardedHotkeys`, `withModalGuard`, and raw `addEventListener` patterns

### `packages/apps/app/src/renderer/src/shortcut-init.ts`

```ts
import { registry, getDispatchPhase, scopeTracker } from '@slayzone/shortcuts'
import { isModalDialogOpen } from '@slayzone/ui'
import { useShortcutStore } from '@slayzone/ui'

export function initShortcuts(): () => void {
  scopeTracker.init()

  const guard = (e: KeyboardEvent): boolean => {
    if (isModalDialogOpen()) return false
    if (useShortcutStore.getState().isRecording) return false
    if (scopeTracker.isBrowserPassthrough()) return false
    return true
  }

  // Capture phase: modifier shortcuts (Cmd+S, Cmd+G, etc.)
  // Fires BEFORE CodeMirror/xterm — prevents library double-handling.
  const captureHandler = (e: KeyboardEvent) => {
    if (!guard(e)) return
    if (!(e.metaKey || e.ctrlKey || e.altKey)) return  // not a modifier shortcut
    registry.dispatch(e, scopeTracker.getActiveScopes())
  }

  // Bubble phase: non-modifier shortcuts (Escape, etc.)
  // Fires AFTER component handlers — Radix dropdowns/popovers consume Escape first.
  const bubbleHandler = (e: KeyboardEvent) => {
    if (!guard(e)) return
    if (e.metaKey || e.ctrlKey || e.altKey) return  // already handled in capture
    registry.dispatch(e, scopeTracker.getActiveScopes())
  }

  window.addEventListener('keydown', captureHandler, { capture: true })
  window.addEventListener('keydown', bubbleHandler)  // bubble phase (default)
  return () => {
    window.removeEventListener('keydown', captureHandler, { capture: true })
    window.removeEventListener('keydown', bubbleHandler)
  }
}
```

Called once from App.tsx on mount. These TWO listeners (same registry, different timing) replace all scattered handlers.

## Browser Passthrough

### Per-panel toggle
Each web panel stores its own passthrough preference in `PanelConfig`. `ScopeTracker` checks the focused panel's state via `isBrowserPassthrough()`.

### Default pass-through keys (when passthrough OFF)
Expand `NATIVE_EDIT_KEYS` in `browser-view-manager.ts` to `BROWSER_DEFAULT_PASSTHROUGH`:
- `Cmd+C/V/X/A/Z` (clipboard + undo)
- `Cmd+ArrowUp/Down` (scroll)
- `Cmd+F` (browser native find)

These are NOT forwarded to renderer — they pass through to the webpage directly.

### When passthrough ON
Two layers cooperate:
1. Main process: `entry.keyboardPassthrough` returns early in `browser-view-manager.ts:646` → all keys reach webpage
2. Renderer: `scopeTracker.isBrowserPassthrough()` bails in capture listener → no app handlers fire for synthetic forwarded events

## Definitions Changes

### Rename `task-panel` → `task` in `definitions.ts`
TypeScript errors guide all consumer updates.

### Add new scoped definitions

```ts
// Editor scope
{ id: 'editor-save', label: 'Save File', group: 'Editor', defaultKeys: 'mod+s', scope: 'editor' },

// Terminal scope (move from terminal, keep existing IDs)
// terminal-search, terminal-clear, terminal-new-group, terminal-split already defined

// Browser scope
{ id: 'browser-find', label: 'Find in Page', group: 'Browser', defaultKeys: 'mod+f', scope: 'browser' },
{ id: 'browser-find-next', label: 'Find Next', group: 'Browser', defaultKeys: 'mod+g', scope: 'browser' },
{ id: 'browser-find-prev', label: 'Find Previous', group: 'Browser', defaultKeys: 'mod+shift+g', scope: 'browser' },
{ id: 'browser-escape', label: 'Cancel / Close Find', group: 'Browser', defaultKeys: 'escape', scope: 'browser' },

// Terminal scope additions
{ id: 'terminal-search-close', label: 'Close Search', group: 'Terminal', defaultKeys: 'escape', scope: 'terminal' },
```

## Web Panel Shortcut Fixes

### Remove broken defaults in `PREDEFINED_WEB_PANELS` (types.ts:102-117)
| Panel | Current | New |
|-------|---------|-----|
| Figma | `y` (conflicts Automations) | remove |
| Notion | `n` (conflicts New Task) | remove |
| GitHub | `h` (conflicts macOS Hide) | remove |
| Excalidraw | `x` (conflicts macOS Cut) | remove |
| Monosketch | `u` (conflicts Tests) | remove |

All predefined panels ship with no shortcut. Users assign their own.

### Fix bare-letter web panel check (TaskDetailPage.tsx:1039)
Current: `e.key === wp.shortcut` — matches without Cmd modifier.
New: migrates into registry as dynamic shortcuts via `useShortcutAction({ keys: 'mod+' + letter, scope: 'task' }, handler)`.

### Replace `RESERVED_PANEL_SHORTCUTS` with `BLOCKED_WEB_PANEL_KEYS`
Update `validatePanelShortcut()` in `panel-config.ts`.

## Main Process Changes

### `browser-view-manager.ts` (lines 645-698)
- Expand `NATIVE_EDIT_KEYS` → `BROWSER_DEFAULT_PASSTHROUGH` (add arrows + `f`)
- Keep main-process-only shortcuts (Cmd+R reload view, Cmd+, settings IPC, Cmd+§ go-home)
- Everything else continues forwarding to renderer via `browser-view:shortcut` IPC

### `index.ts` (lines 657-693)
- Keep as-is — highest-priority main-process shortcuts
- Optional later cleanup: extract to `shortcut-dispatcher.ts`

## Migration Order

### Phase 1: Foundation (no behavior changes)
1. Add `scope.ts`, `registry.ts`, `scope-tracker.ts`, `blocked-keys.ts` to `@slayzone/shortcuts`
2. Add `useShortcutAction.ts` to `@slayzone/ui`
3. Add `shortcut-init.ts` to renderer — install global capture listener **alongside** existing handlers (both systems active during migration)
4. Rename `task-panel` → `task` in definitions + all consumers
5. Add `editor`, `browser`, and new `terminal` scoped definitions
6. Unit tests for registry dispatch priority, scope tracker detection, blocklist validation

### Phase 2: Migrate renderer handlers (one-by-one, remove old handler as each migrates)
1. App.tsx global hotkeys (`useGuardedHotkeys` calls) → `useShortcutAction`
2. App.tsx home-panel raw keydown handler → `useShortcutAction`
3. TaskDetailPage panel-toggle keydown handler → `useShortcutAction`
4. TaskDetailPage terminal shortcuts (inject title/desc, restart) → `useShortcutAction`
5. TerminalContainer shortcuts (new-group, split) → `useShortcutAction`
6. BrowserPanel find-in-page (Cmd+F, Cmd+G) → `useShortcutAction`
7. Terminal.tsx: remove `terminal-search` and `terminal-clear` from xterm handler, register via `useShortcutAction`
8. CodeEditor.tsx: remove `Mod-s` from CM keymap, register via `useShortcutAction`
9. MarkdownFileEditor.tsx: remove `Cmd+S` DOM listener, register via `useShortcutAction`
10. Terminal search bar Escape → `useShortcutAction('terminal-search-close', ...)`
11. BrowserPanel element picker Escape → `useShortcutAction('browser-escape', ...)`

### Phase 3: Browser passthrough + web panel fixes
1. Expand `NATIVE_EDIT_KEYS` → `BROWSER_DEFAULT_PASSTHROUGH` in browser-view-manager
2. Add per-panel passthrough state to `PanelConfig` type + settings persistence
3. Wire passthrough into `ScopeTracker`
4. Remove broken predefined web panel shortcuts
5. Expand `validatePanelShortcut` blocklist
6. Migrate dynamic web panel shortcuts to registry

### Phase 4: Cleanup
1. Remove `useGuardedHotkeys.ts`, `withModalGuard.ts`, `is-modal-dialog-open.ts` (modal check moves into `shortcut-init.ts`)
2. Remove `react-hotkeys-hook` dependency from package.json
3. Remove `lastFocusedPanelRef` + `isTerminalFocused()` + manual `inCodeMirror`/`inEditor` checks from TaskDetailPage
4. Optional: extract main-process handlers into `shortcut-dispatcher.ts`

## Files Modified

| File | Change |
|------|--------|
| `packages/shared/shortcuts/src/scope.ts` | **NEW** — scope types + priority |
| `packages/shared/shortcuts/src/registry.ts` | **NEW** — central handler registry |
| `packages/shared/shortcuts/src/scope-tracker.ts` | **NEW** — focus-based scope detection |
| `packages/shared/shortcuts/src/blocked-keys.ts` | **NEW** — web panel blocklist |
| `packages/shared/shortcuts/src/definitions.ts` | Rename `task-panel` → `task`, add `editor`/`browser` scoped shortcuts |
| `packages/shared/shortcuts/src/index.ts` | Export new modules |
| `packages/shared/ui/src/useShortcutAction.ts` | **NEW** — React hook |
| `packages/shared/ui/src/useShortcutStore.ts` | Update `ShortcutScope` import (renamed type) |
| `packages/apps/app/src/renderer/src/shortcut-init.ts` | **NEW** — global capture listener setup |
| `packages/apps/app/src/renderer/src/App.tsx` | Replace `useGuardedHotkeys` + raw listeners with `useShortcutAction` |
| `packages/domains/task/src/client/TaskDetailPage.tsx` | Replace keydown handlers with `useShortcutAction`, remove focus-tracking code |
| `packages/domains/task-terminals/src/client/TerminalContainer.tsx` | Replace keydown handler with `useShortcutAction` |
| `packages/domains/terminal/src/client/Terminal.tsx` | Remove search/clear from xterm handler, register via `useShortcutAction` |
| `packages/domains/file-editor/src/client/CodeEditor.tsx` | Remove `Mod-s` from CM keymap, register via `useShortcutAction` |
| `packages/domains/file-editor/src/client/MarkdownFileEditor.tsx` | Remove Cmd+S DOM listener, register via `useShortcutAction` |
| `packages/domains/task-browser/src/client/BrowserPanel.tsx` | Replace find-in-page handler with `useShortcutAction` |
| `packages/domains/task/src/shared/types.ts` | Remove predefined panel shortcuts |
| `packages/domains/task/src/shared/panel-config.ts` | Expand blocklist, update validation |
| `packages/apps/app/src/main/browser-view-manager.ts` | Expand default passthrough keys |

## What Stays As-Is

- **xterm `attachCustomKeyEventHandler`** — keeps Ctrl+Tab blocking, Shift+Enter (claude-code), Ctrl+Shift+C/V, Cmd+Arrow scroll. These are terminal-internal behaviors, not app shortcuts.
- **CodeMirror keymap** — keeps Tab/Shift-Tab indent. Not app shortcuts.
- **Main process `before-input-event`** (index.ts:657-693) — go-home, settings, screenshot, reload. Must run in main process.
- **`useShortcutStore`** — Zustand store for customization. Registry reads from it.

## Verification

1. **Unit tests**: Registry dispatch resolves highest-priority scope. ScopeTracker detects focus correctly. Blocklist rejects conflicting keys. Multiple handlers same key — correct one fires based on scope.
2. **Manual test matrix**:
   - Cmd+S in editor → saves file (NOT settings toggle)
   - Cmd+S outside editor → toggles settings
   - Cmd+G in browser panel → find-next (NOT git panel)
   - Cmd+G outside browser → toggles git panel
   - Cmd+T in terminal → new group (NOT terminal toggle)
   - Cmd+T outside terminal → toggles terminal panel
   - Cmd+F in terminal → terminal search; in browser → browser find
   - Escape in terminal search → closes search (NOT exit zen)
   - Escape with Radix dropdown open → closes dropdown (NOT exit zen)
   - Escape outside search/dropdown → exits zen/explode
   - Browser passthrough ON → all shortcuts reach webpage, no app handlers fire
   - Browser passthrough OFF → Cmd+C/V/X/A/Z + Cmd+Arrows + Cmd+F reach webpage, others intercepted
   - Shortcut customization: rebind Cmd+S → Cmd+Shift+S, verify editor save uses new binding
   - Web panel shortcut assignment rejects Cmd+H, Cmd+N, Cmd+X etc.
   - Modal open → no shortcuts fire
3. **E2E**: Existing shortcut tests in `e2e/` should pass without changes
