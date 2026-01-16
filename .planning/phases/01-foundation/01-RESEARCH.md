# Phase 1: Foundation - Research

**Researched:** 2026-01-17
**Domain:** Electron + React + SQLite Foundation
**Confidence:** HIGH

## Summary

Phase 1 establishes secure Electron shell with IPC patterns and SQLite database. The stack is well-defined from project research: electron-vite for build tooling, React 18 + TypeScript for UI, better-sqlite3 for database, Tailwind CSS v4 + shadcn/ui for styling.

Key challenges: native module (better-sqlite3) rebuild for Electron's Node version, secure IPC patterns via contextBridge, correct database path using `app.getPath('userData')`, and shadcn/ui path alias configuration.

**Primary recommendation:** Use electron-vite react-ts template, configure better-sqlite3 as external in rollup, establish typed IPC from day one.

## Standard Stack

Locked from project research. No alternatives needed.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| electron-vite | ^3.x | Build/dev tooling | Fast HMR, react-ts template, handles main/preload/renderer builds |
| Electron | ^34.x | Desktop runtime | Latest stable, Chromium 132, Node 20.18.1 |
| React | ^18.x | UI library | Required by shadcn/ui, stable hooks API |
| TypeScript | ^5.x | Type safety | Catches IPC type mismatches early |
| better-sqlite3 | ^12.4+ | SQLite binding | Fastest Node SQLite, sync API fine in main process |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @electron/rebuild | ^3.x+ | Native module rebuild | After every npm install |
| Tailwind CSS | ^4.x | Styling | Atomic CSS, pairs with shadcn/ui |
| shadcn/ui | latest | Component library | Copy components to codebase |
| @tailwindcss/vite | latest | Vite plugin | Required for Tailwind v4 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| electron-vite | electron-forge | Vite support still experimental in forge |
| better-sqlite3 | sql.js | 10-50x slower, loads entire DB in memory |

**Installation:**
```bash
# Create project
npm create @quick-start/electron@latest focus -- --template react-ts
cd focus

# Core dependencies
npm install better-sqlite3

# Dev dependencies
npm install -D @electron/rebuild tailwindcss @tailwindcss/vite

# Rebuild native module for Electron
npx electron-rebuild -f -w better-sqlite3

# Initialize shadcn/ui (after config setup)
npx shadcn@latest init
```

## Architecture Patterns

### Recommended Project Structure
```
focus/
├── electron.vite.config.ts    # Build config
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── jsconfig.json              # For shadcn path aliases (if JS)
├── components.json            # shadcn config
├── src/
│   ├── main/                  # Main process
│   │   ├── index.ts           # Entry, creates window
│   │   ├── ipc/               # IPC handlers
│   │   │   └── database.ts    # db:* channel handlers
│   │   └── db/                # Database layer
│   │       ├── index.ts       # better-sqlite3 instance
│   │       ├── migrations.ts  # Migration runner
│   │       └── schema.ts      # Table definitions
│   │
│   ├── preload/               # Preload scripts
│   │   └── index.ts           # contextBridge API
│   │
│   ├── renderer/              # React app
│   │   ├── index.html
│   │   ├── src/
│   │   │   ├── main.tsx       # React entry
│   │   │   ├── App.tsx        # Root component
│   │   │   ├── assets/
│   │   │   │   └── main.css   # Tailwind imports
│   │   │   ├── components/
│   │   │   │   └── ui/        # shadcn components
│   │   │   └── lib/
│   │   │       └── utils.ts   # cn() helper
│   │
│   └── shared/                # Shared between processes
│       └── types/
│           ├── api.ts         # IPC API types
│           └── database.ts    # Entity types
│
└── resources/                 # Static assets
```

### Pattern 1: Typed IPC via contextBridge

Define API shape once, use everywhere.

```typescript
// src/shared/types/api.ts
export interface ElectronAPI {
  db: {
    getTasks: () => Promise<Task[]>
    createTask: (data: CreateTaskInput) => Promise<Task>
    getProjects: () => Promise<Project[]>
    createProject: (data: CreateProjectInput) => Promise<Project>
  }
}

// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron'
import type { ElectronAPI } from '../shared/types/api'

const api: ElectronAPI = {
  db: {
    getTasks: () => ipcRenderer.invoke('db:tasks:getAll'),
    createTask: (data) => ipcRenderer.invoke('db:tasks:create', data),
    getProjects: () => ipcRenderer.invoke('db:projects:getAll'),
    createProject: (data) => ipcRenderer.invoke('db:projects:create', data),
  }
}

contextBridge.exposeInMainWorld('api', api)

// src/renderer/src/types/global.d.ts
import type { ElectronAPI } from '../../shared/types/api'

declare global {
  interface Window {
    api: ElectronAPI
  }
}
```

Source: [Electron Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation)

### Pattern 2: Secure BrowserWindow Configuration

Always start with security baseline.

```typescript
// src/main/index.ts
import { app, BrowserWindow } from 'electron'
import path from 'path'

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,     // CRITICAL: Never enable
      contextIsolation: true,     // CRITICAL: Always enable
      sandbox: true,              // CRITICAL: Always enable
      webSecurity: true,          // Keep enabled
      allowRunningInsecureContent: false,
    },
  })

  // Load the vite dev server in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}
```

Source: [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)

### Pattern 3: Database Path with app.getPath

Never use `__dirname` for database path.

```typescript
// src/main/db/index.ts
import { app } from 'electron'
import Database from 'better-sqlite3'
import path from 'path'

const getDatabasePath = (): string => {
  const userDataPath = app.getPath('userData')
  const dbName = app.isPackaged ? 'focus.sqlite' : 'focus.dev.sqlite'
  return path.join(userDataPath, dbName)
}

let db: Database.Database | null = null

export function getDatabase(): Database.Database {
  if (!db) {
    const dbPath = getDatabasePath()
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    runMigrations(db)
  }
  return db
}
```

Database locations:
- macOS: `~/Library/Application Support/Focus/focus.sqlite`
- Windows: `C:\Users\<user>\AppData\Local\Focus\focus.sqlite`
- Linux: `~/.config/Focus/focus.sqlite`

### Pattern 4: Simple Migrations with user_version

No ORM needed. Use SQLite's `user_version` pragma.

```typescript
// src/main/db/migrations.ts
import Database from 'better-sqlite3'

interface Migration {
  version: number
  up: (db: Database.Database) => void
}

const migrations: Migration[] = [
  {
    version: 1,
    up: (db) => {
      db.exec(`
        CREATE TABLE projects (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          color TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE tasks (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          parent_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          description TEXT,
          status TEXT NOT NULL DEFAULT 'inbox',
          priority INTEGER NOT NULL DEFAULT 3,
          due_date TEXT,
          blocked_reason TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE workspace_items (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          type TEXT NOT NULL,
          name TEXT NOT NULL,
          content TEXT,
          url TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX idx_tasks_project ON tasks(project_id);
        CREATE INDEX idx_tasks_parent ON tasks(parent_id);
        CREATE INDEX idx_tasks_status ON tasks(status);
        CREATE INDEX idx_workspace_task ON workspace_items(task_id);
      `)
    }
  }
]

export function runMigrations(db: Database.Database): void {
  const currentVersion = db.pragma('user_version', { simple: true }) as number

  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      db.transaction(() => {
        migration.up(db)
        db.pragma(`user_version = ${migration.version}`)
      })()
    }
  }
}
```

Source: [SQLite DB Migrations with PRAGMA user_version](https://levlaz.org/sqlite-db-migrations-with-pragma-user_version/)

### Anti-Patterns to Avoid
- **nodeIntegration: true**: XSS becomes RCE. Never enable.
- **Exposing raw ipcRenderer**: `contextBridge.exposeInMainWorld('ipc', ipcRenderer)` - security hole.
- **ipcRenderer.sendSync()**: Blocks renderer, freezes UI. Always use `invoke()`.
- **Database in __dirname**: Fails in packaged app. Use `app.getPath('userData')`.
- **BrowserRouter**: Doesn't work with `file://` protocol. Use HashRouter.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Native module rebuild | Manual compilation | @electron/rebuild | Handles ABI version matching |
| IPC type safety | Runtime checks | TypeScript interfaces + contextBridge | Compile-time errors |
| Database path | Path concatenation | app.getPath('userData') | Works in dev and packaged |
| Schema migrations | Ad-hoc ALTER TABLE | user_version pragma pattern | Tracks state, idempotent |
| CSS framework | Custom CSS | Tailwind + shadcn/ui | Accessible, consistent |

**Key insight:** Electron has many subtle differences between dev and production (paths, protocols, sandbox). Use established patterns.

## Common Pitfalls

### Pitfall 1: NODE_MODULE_VERSION Mismatch
**What goes wrong:** App crashes with "module compiled against different Node.js version"
**Why it happens:** better-sqlite3 compiled for system Node, not Electron's Node
**How to avoid:** Add postinstall script:
```json
{
  "scripts": {
    "postinstall": "electron-rebuild -f -w better-sqlite3"
  }
}
```
**Warning signs:** Works in dev, crashes in production build

### Pitfall 2: Database Path Fails in Packaged App
**What goes wrong:** SQLITE_CANTOPEN error in production
**Why it happens:** Using `__dirname` which points to ASAR archive
**How to avoid:** Always use `app.getPath('userData')` for database
**Warning signs:** `path.join(__dirname, 'database.sqlite')` in codebase

### Pitfall 3: shadcn Init Fails
**What goes wrong:** "supported framework was not found" error
**Why it happens:** shadcn CLI looks for `vite.config.*` in root, electron-vite uses `electron.vite.config.ts`
**How to avoid:** Copy or symlink `electron.vite.config.ts` to `vite.config.ts`, configure path alias `@` in both files
**Warning signs:** shadcn init command fails immediately

### Pitfall 4: IPC Memory Leaks
**What goes wrong:** Memory grows over time, app slows down
**Why it happens:** Adding `ipcRenderer.on()` listeners without cleanup
**How to avoid:** Always remove listeners in useEffect cleanup:
```typescript
useEffect(() => {
  const handler = (data) => { /* ... */ }
  window.api.onSomeEvent(handler)
  return () => window.api.removeSomeEventListener(handler)
}, [])
```
**Warning signs:** Multiple handlers firing for single event

### Pitfall 5: Vite Config for Native Modules
**What goes wrong:** Build fails or native module not found at runtime
**Why it happens:** Vite tries to bundle better-sqlite3 which is CommonJS native module
**How to avoid:** Mark as external in rollup config:
```typescript
build: {
  rollupOptions: {
    external: ['better-sqlite3']
  }
}
```
**Warning signs:** Build errors mentioning require() or .node files

## Code Examples

### electron.vite.config.ts with better-sqlite3
```typescript
// electron.vite.config.ts
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        external: ['better-sqlite3']
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@': resolve('src/renderer/src')
      }
    },
    plugins: [react(), tailwindcss()]
  }
})
```

Source: [electron-vite C/C++ Addons](https://electron-vite.github.io/guide/cpp-addons.html)

### IPC Handler Registration
```typescript
// src/main/ipc/database.ts
import { ipcMain } from 'electron'
import { getDatabase } from '../db'

export function registerDatabaseHandlers(): void {
  const db = getDatabase()

  ipcMain.handle('db:tasks:getAll', () => {
    return db.prepare('SELECT * FROM tasks').all()
  })

  ipcMain.handle('db:tasks:create', (_, data) => {
    const id = crypto.randomUUID()
    const stmt = db.prepare(`
      INSERT INTO tasks (id, project_id, title, status, priority)
      VALUES (?, ?, ?, ?, ?)
    `)
    stmt.run(id, data.projectId, data.title, data.status ?? 'inbox', data.priority ?? 3)
    return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
  })

  ipcMain.handle('db:projects:getAll', () => {
    return db.prepare('SELECT * FROM projects').all()
  })

  ipcMain.handle('db:projects:create', (_, data) => {
    const id = crypto.randomUUID()
    const stmt = db.prepare(`
      INSERT INTO projects (id, name, color)
      VALUES (?, ?, ?)
    `)
    stmt.run(id, data.name, data.color)
    return db.prepare('SELECT * FROM projects WHERE id = ?').get(id)
  })
}
```

### main.css for Tailwind v4
```css
/* src/renderer/src/assets/main.css */
@import "tailwindcss";
```

### Security Verification Test
```typescript
// Manual verification checklist for Phase 1 completion
// Run in browser devtools of running app:

// Should be undefined (contextIsolation working)
console.log(window.require) // undefined
console.log(window.process) // undefined

// Should exist (preload API working)
console.log(window.api) // { db: { ... } }
console.log(window.api.db.getTasks) // [Function]
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| electron-forge webpack | electron-vite | 2024 | 10x faster HMR |
| Tailwind v3 config | Tailwind v4 CSS-first | 2025 | No tailwind.config needed |
| BrowserView | WebContentsView | Electron 30+ | New architecture for embeds |
| webview tag | iframe or WebContentsView | Electron 30+ | webview deprecated |

**Deprecated/outdated:**
- `@electron/remote`: Security risk, don't use
- `nodeIntegration: true`: Never enable
- `webviewTag: true`: Avoid, use WebContentsView

## Open Questions

1. **Electron version prebuilds**
   - What we know: better-sqlite3 v12.6.0 has prebuilds for Electron v121 and v123
   - What's unclear: Whether Electron 34 ABI version matches these
   - Recommendation: Use electron-rebuild from source. Works reliably.

2. **Tailwind v4 + shadcn stability**
   - What we know: shadcn supports Tailwind v4 as of late 2025
   - What's unclear: Edge cases in electron-vite integration
   - Recommendation: Follow 2025 setup guide, may need vite.config.ts symlink

## Sources

### Primary (HIGH confidence)
- [Electron Security Documentation](https://www.electronjs.org/docs/latest/tutorial/security) - security checklist, webPreferences
- [Electron Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation) - contextBridge patterns
- [electron-vite Getting Started](https://electron-vite.org/guide/) - project scaffolding
- [electron-vite C/C++ Addons](https://electron-vite.github.io/guide/cpp-addons.html) - native module config

### Secondary (MEDIUM confidence)
- [2025 Electron-Vite + Tailwind-Shadcn Guide](https://blog.mohitnagaraj.in/blog/202505/Electron_Shadcn_Guide) - shadcn setup steps
- [better-sqlite3 npm](https://www.npmjs.com/package/better-sqlite3) - version info, prebuilds
- [SQLite Migrations with user_version](https://levlaz.org/sqlite-db-migrations-with-pragma-user_version/) - migration pattern

### Tertiary (LOW confidence)
- WebSearch results on electron-vite + shadcn integration (multiple sources agree)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - defined in project research, official docs verify
- Architecture: HIGH - Electron official patterns, electron-vite docs
- Pitfalls: HIGH - documented in project research, verified with sources

**Research date:** 2026-01-17
**Valid until:** 2026-02-17 (stable stack, 30 days)
