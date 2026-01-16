# Technology Stack

**Project:** Focus (Desktop Task Management)
**Researched:** 2026-01-17

## Recommended Stack

### Build Tooling

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| electron-vite | ^5.0.0 | Build/dev tooling | Fast HMR, sensible defaults, React+TS out of box. Vite-based = instant reload vs webpack crawl. V8 bytecode protection for source code. | HIGH |
| Electron | ^34.x | Desktop runtime | Latest stable. Chromium 132, Node 20.18.1. 8-week release cycle. | HIGH |

**Why electron-vite over electron-forge:**
- electron-forge's Vite support still marked "experimental" (v7.5.0+)
- electron-vite provides React+TS templates out of box
- Much faster dev loop (Vite HMR vs webpack)
- electron-forge better for packaging stability but electron-vite uses electron-builder which is mature

**Create project:**
```bash
pnpm create @quick-start/electron focus --template react-ts
```

### Frontend Framework

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| React | ^18.x | UI library | Industry standard, shadcn/ui requires it | HIGH |
| TypeScript | ^5.x | Type safety | Required by electron-vite templates, catches bugs early | HIGH |
| Tailwind CSS | ^4.x | Styling | Atomic CSS, pairs with shadcn/ui | HIGH |
| shadcn/ui | latest | Component library | Not a dependency - copies components into your codebase. Customizable, accessible, Tailwind-based | HIGH |

**Note:** shadcn/ui is not installed via npm. You run `npx shadcn@latest init` then add components with `npx shadcn@latest add button`. Components live in your codebase.

### Database

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| better-sqlite3 | ^12.4.1 | SQLite binding | Fastest Node SQLite. Sync API (actually better for Electron main process). 2000+ queries/sec possible. | MEDIUM |
| @electron/rebuild | ^4.x | Native module rebuild | Required to rebuild better-sqlite3 against Electron's Node version | HIGH |

**Why better-sqlite3 over sql.js:**
- 10-50x faster (native vs WASM)
- No memory limit (sql.js loads entire DB into memory)
- Sync API is fine in main process (doesn't block renderer)

**Tradeoff:** Native module complexity. Requires electron-rebuild. Build issues reported on Windows 11 (2025). Worth it for performance.

**Setup:**
```bash
npm install --save better-sqlite3
npm install --save-dev @electron/rebuild
# Add to package.json scripts:
# "rebuild": "electron-rebuild -f -w better-sqlite3"
npm run rebuild
```

### State Management

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Zustand | ^5.0.10 | Client state | Tiny (1.1kB), no boilerplate, works with React 18+. Sweet spot between Context (too simple) and Redux (too complex). | HIGH |

**Why Zustand over Jotai:**
- Zustand = single store, simpler mental model for task management app
- Jotai = atomic state, overkill unless surgical re-render control needed
- Both pmndrs libraries, similar quality

**Pattern for Electron:** Zustand store in renderer, data fetched via IPC from main process. Don't share Zustand store between processes.

### Drag and Drop

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| @dnd-kit/core | ^6.3.1 | DnD primitives | Modern, accessible, actively maintained. Kanban examples available. | HIGH |
| @dnd-kit/sortable | ^8.x | Sortable lists | Required for reordering within columns | HIGH |

**Why dnd-kit over alternatives:**
- react-beautiful-dnd: **DEPRECATED** (archived April 2025). Don't use.
- hello-pangea/dnd: Fork of RBD, maintenance-mode stopgap
- pragmatic-drag-and-drop: Atlassian's successor, headless/low-level, more work to implement
- dnd-kit: Best balance of features, DX, and active maintenance

**Installation:**
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

### Markdown Editor

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| MDXEditor | ^3.52.3 | WYSIWYG markdown | Notion-like editing. Built on Lexical. Inline WYSIWYG (no split-pane preview). | MEDIUM |

**Why MDXEditor:**
- WYSIWYG by default (unlike @uiw/react-md-editor which is split-pane)
- Plugin architecture for extensibility
- Built on Meta's Lexical framework
- Can embed React components (useful for future features)

**Tradeoff:** Bundle size (~851kB gzipped). Acceptable for desktop app, not for web.

**Alternative if bundle matters:** @uiw/react-md-editor (~4.6kB gzipped) but it's split-pane, not WYSIWYG.

**Installation:**
```bash
npm install @mdxeditor/editor
```

**SSR Note:** MDXEditor shouldn't be rendered server-side (Lexical limitation). Not relevant for Electron.

### Embedded Web Views

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| WebContentsView | (Electron API) | Browser tabs in Work Mode | Official replacement for deprecated BrowserView (deprecated Electron 30+). | HIGH |
| BaseWindow | (Electron API) | Main window | Required for WebContentsView architecture | HIGH |

**Architecture change:** Use `BaseWindow` + `WebContentsView` instead of `BrowserWindow` + `<webview>`. The `<webview>` tag is not recommended by Electron team (stability issues, may be removed).

**Migration from BrowserView to WebContentsView is straightforward:** Same constructor shape, same methods (`setBounds`, `getBounds`, `setBackgroundColor`).

## IPC Patterns

### Context Bridge Pattern (Security)

**DO:**
```typescript
// preload.ts
contextBridge.exposeInMainWorld('electronAPI', {
  getTasks: () => ipcRenderer.invoke('db:getTasks'),
  createTask: (task: Task) => ipcRenderer.invoke('db:createTask', task),
  onTaskUpdated: (callback: (task: Task) => void) =>
    ipcRenderer.on('task:updated', (_event, task) => callback(task))
})
```

**DON'T:**
```typescript
// NEVER expose full ipcRenderer
contextBridge.exposeInMainWorld('ipcRenderer', ipcRenderer) // Security hole
```

### IPC Best Practices

| Pattern | Use | Avoid |
|---------|-----|-------|
| `ipcRenderer.invoke()` | Async request/response | `ipcRenderer.sendSync()` (blocks renderer) |
| `ipcMain.handle()` | Handle invoke calls | - |
| `webContents.send()` | Push from main to renderer | - |
| Validate sender | Always check `event.sender` | Trusting any IPC message |

### Recommended IPC Structure

```
src/
  main/
    ipc/
      db.ts       # Database operations
      tasks.ts    # Task-specific handlers
      window.ts   # Window management
    index.ts      # Register all handlers
  preload/
    index.ts      # exposeInMainWorld definitions
  renderer/
    api/
      tasks.ts    # Type-safe wrappers around window.electronAPI
```

## Full Installation

```bash
# Create project
pnpm create @quick-start/electron focus --template react-ts
cd focus

# Core dependencies
npm install better-sqlite3 zustand @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities @mdxeditor/editor

# Dev dependencies
npm install -D @electron/rebuild tailwindcss postcss autoprefixer

# Rebuild native modules
npx electron-rebuild -f -w better-sqlite3

# Initialize Tailwind
npx tailwindcss init -p

# Initialize shadcn/ui
npx shadcn@latest init
```

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Build tool | electron-vite | electron-forge | Vite support still experimental in forge |
| SQLite | better-sqlite3 | sql.js | 10-50x slower, memory-bound |
| SQLite | better-sqlite3 | Node 22 built-in sqlite | Not mature yet, better-sqlite3 faster |
| State | Zustand | Redux Toolkit | Overkill for this app size |
| State | Zustand | Jotai | Atomic model unnecessary here |
| DnD | dnd-kit | react-beautiful-dnd | Deprecated, archived April 2025 |
| DnD | dnd-kit | pragmatic-drag-and-drop | Lower-level, more implementation work |
| Markdown | MDXEditor | @uiw/react-md-editor | Not true WYSIWYG |
| Markdown | MDXEditor | Milkdown | Less React-native, heavier setup |
| Web views | WebContentsView | `<webview>` tag | Deprecated, stability issues |

## Version Requirements Summary

| Technology | Min Version | Notes |
|------------|-------------|-------|
| Node.js | 22.x | Required by @electron/ ecosystem in 2025 |
| React | 18.x | Required by Zustand v5 |
| TypeScript | 4.5+ | Required by Zustand v5 |
| Electron | 34.x | Latest stable, WebContentsView support |

## Sources

**Build Tooling:**
- [electron-vite official site](https://electron-vite.org/)
- [Electron Forge Vite docs](https://www.electronforge.io/templates/vite)
- [electron-vite FAQ on Forge](https://electron-vite.github.io/faq/electron-forge.html)

**Database:**
- [better-sqlite3 npm](https://www.npmjs.com/package/better-sqlite3)
- [better-sqlite3 GitHub](https://github.com/WiseLibs/better-sqlite3)
- [npm trends: better-sqlite3 vs sql.js](https://npmtrends.com/better-sqlite3-vs-sql.js-vs-sqlite3)

**State Management:**
- [Zustand v5 migration guide](https://zustand.docs.pmnd.rs/migrations/migrating-to-v5)
- [State Management 2025 comparison](https://dev.to/hijazi313/state-management-in-2025-when-to-use-context-redux-zustand-or-jotai-2d2k)

**Drag and Drop:**
- [dnd-kit official site](https://dndkit.com/)
- [dnd-kit GitHub](https://github.com/clauderic/dnd-kit)
- [react-beautiful-dnd deprecation](https://github.com/atlassian/react-beautiful-dnd/issues/2672)
- [pragmatic-drag-and-drop](https://atlassian.design/components/pragmatic-drag-and-drop/)

**Markdown:**
- [MDXEditor docs](https://mdxeditor.dev/)
- [Best Markdown Editors for React](https://strapi.io/blog/top-5-markdown-editors-for-react)

**Electron IPC:**
- [Electron IPC tutorial](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [contextBridge docs](https://www.electronjs.org/docs/latest/api/context-bridge)
- [Electron security docs](https://www.electronjs.org/docs/latest/tutorial/security)

**Web Views:**
- [Migrating to WebContentsView](https://www.electronjs.org/blog/migrate-to-webcontentsview)
- [BrowserView deprecation](https://www.electronjs.org/docs/latest/api/browser-view)

**shadcn/ui + Electron:**
- [electron-shadcn template](https://github.com/LuanRoger/electron-shadcn)
- [2025 Setup Guide](https://blog.mohitnagaraj.in/blog/202505/Electron_Shadcn_Guide)
