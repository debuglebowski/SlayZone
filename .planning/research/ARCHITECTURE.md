# Architecture Patterns

**Domain:** Desktop task management with AI integration (Electron + React + SQLite)
**Researched:** 2026-01-17
**Confidence:** HIGH (based on official Electron docs and established patterns)

## Recommended Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           MAIN PROCESS                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │   SQLite     │  │   Claude     │  │  File System │               │
│  │   (better-   │  │   CLI        │  │   Access     │               │
│  │   sqlite3)   │  │   Spawner    │  │              │               │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘               │
│         │                 │                 │                        │
│         └────────────┬────┴─────────────────┘                        │
│                      │                                               │
│              ┌───────▼───────┐                                       │
│              │  IPC Handlers │ (ipcMain.handle / ipcMain.on)         │
│              └───────┬───────┘                                       │
└──────────────────────┼───────────────────────────────────────────────┘
                       │
              ┌────────▼────────┐
              │  PRELOAD SCRIPT │  (contextBridge.exposeInMainWorld)
              └────────┬────────┘
                       │
┌──────────────────────┼───────────────────────────────────────────────┐
│                      │           RENDERER PROCESS                    │
│              ┌───────▼───────┐                                       │
│              │ window.api    │  (exposed via contextBridge)          │
│              └───────┬───────┘                                       │
│                      │                                               │
│  ┌───────────────────┼───────────────────────────────────────────┐   │
│  │                   │        REACT APP                          │   │
│  │  ┌────────────────▼────────────────┐                          │   │
│  │  │     React Query / SWR           │  (data fetching layer)   │   │
│  │  │     or Zustand + hooks          │                          │   │
│  │  └────────────────┬────────────────┘                          │   │
│  │                   │                                            │   │
│  │  ┌────────────────▼────────────────┐                          │   │
│  │  │     UI Components               │  (shadcn/ui + Tailwind)  │   │
│  │  │     - Task views                │                          │   │
│  │  │     - AI chat                   │                          │   │
│  │  │     - Work mode shell           │                          │   │
│  │  └────────────────┬────────────────┘                          │   │
│  │                   │                                            │   │
│  │  ┌────────────────▼────────────────┐                          │   │
│  │  │     WebContentsView / iframe    │  (embedded browser)      │   │
│  │  │     for Work Mode               │                          │   │
│  │  └─────────────────────────────────┘                          │   │
│  └────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────┘
```

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Main Process** | System access, persistence, process spawning | Preload via IPC |
| **SQLite Handler** | CRUD ops, migrations, query execution | Main process only |
| **Claude CLI Spawner** | Spawn claude CLI, stream stdout/stderr | Main process, streams to renderer |
| **Preload Script** | Expose safe API surface to renderer | Both processes via contextBridge |
| **React App** | UI rendering, local state, user interaction | Preload API only |
| **Data Layer** | Cache, refetch, optimistic updates | React components, Preload API |
| **Embedded Browser** | Display external content in work mode | React app (positioning), Main (security) |

## Data Flow

### Read Path (SQLite to UI)

```
1. React component calls window.api.tasks.getAll()
2. Preload script calls ipcRenderer.invoke('db:tasks:getAll')
3. Main process receives, queries SQLite via better-sqlite3
4. Result returned through invoke Promise chain
5. React Query/SWR caches result, component re-renders
```

### Write Path (UI to SQLite)

```
1. User action triggers window.api.tasks.create(data)
2. Preload script calls ipcRenderer.invoke('db:tasks:create', data)
3. Main process validates, inserts into SQLite
4. Returns new record (or error)
5. React invalidates cache, triggers refetch
```

### Streaming Path (Claude CLI to UI)

```
1. React calls window.api.claude.stream(prompt)
2. Preload exposes callback-based API (not Promise)
3. Main spawns child_process.spawn('claude', [...args])
4. stdout.on('data') → webContents.send('claude:chunk', chunk)
5. Preload listens → calls registered callback
6. React component appends chunk to streaming state
7. On process exit → send final event, cleanup
```

## Patterns to Follow

### Pattern 1: Channel-Based IPC Organization

Organize IPC handlers by domain with colon-separated channels.

```typescript
// main/ipc/handlers.ts
export function registerHandlers() {
  // Database channels
  ipcMain.handle('db:tasks:getAll', async () => db.tasks.all());
  ipcMain.handle('db:tasks:create', async (_, data) => db.tasks.create(data));
  ipcMain.handle('db:tasks:update', async (_, id, data) => db.tasks.update(id, data));

  // Claude channels
  ipcMain.handle('claude:query', async (_, prompt) => runClaudeSync(prompt));
  // For streaming, use send/on pattern instead of handle/invoke
}
```

### Pattern 2: Typed Preload API

Define the API shape once, use everywhere.

```typescript
// shared/types/api.ts
export interface ElectronAPI {
  tasks: {
    getAll: () => Promise<Task[]>;
    create: (data: CreateTask) => Promise<Task>;
    update: (id: string, data: UpdateTask) => Promise<Task>;
    delete: (id: string) => Promise<void>;
  };
  claude: {
    stream: (prompt: string, onChunk: (chunk: string) => void) => Promise<void>;
    cancel: () => void;
  };
}

// preload/index.ts
const api: ElectronAPI = {
  tasks: {
    getAll: () => ipcRenderer.invoke('db:tasks:getAll'),
    create: (data) => ipcRenderer.invoke('db:tasks:create', data),
    // ...
  },
  claude: {
    stream: (prompt, onChunk) => {
      ipcRenderer.on('claude:chunk', (_, chunk) => onChunk(chunk));
      return ipcRenderer.invoke('claude:stream:start', prompt);
    },
    cancel: () => ipcRenderer.send('claude:stream:cancel'),
  },
};
contextBridge.exposeInMainWorld('api', api);
```

### Pattern 3: Streaming with Callbacks (not Promises)

Promises deliver results all at once. Streaming needs callbacks.

```typescript
// main/claude/streamer.ts
export function streamClaude(win: BrowserWindow, prompt: string) {
  const proc = spawn('claude', ['-p', prompt], {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  proc.stdout.on('data', (data) => {
    win.webContents.send('claude:chunk', data.toString());
  });

  proc.stderr.on('data', (data) => {
    win.webContents.send('claude:error', data.toString());
  });

  proc.on('close', (code) => {
    win.webContents.send('claude:done', { code });
  });

  return proc; // Return for cancellation
}
```

### Pattern 4: React State for Streaming

Use reducer pattern for streaming accumulation.

```typescript
// renderer/hooks/useClaudeStream.ts
function useClaudeStream() {
  const [state, dispatch] = useReducer(streamReducer, {
    chunks: [],
    status: 'idle'
  });

  const stream = useCallback((prompt: string) => {
    dispatch({ type: 'START' });
    window.api.claude.stream(
      prompt,
      (chunk) => dispatch({ type: 'CHUNK', chunk }),
    ).then(() => dispatch({ type: 'DONE' }))
     .catch((err) => dispatch({ type: 'ERROR', err }));
  }, []);

  return { ...state, stream };
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Direct Node.js in Renderer

**What:** Enabling `nodeIntegration: true` in renderer.
**Why bad:** Major security vulnerability. XSS becomes RCE.
**Instead:** Use preload + contextBridge exclusively.

### Anti-Pattern 2: Exposing Raw IPC

**What:** `contextBridge.exposeInMainWorld('ipc', ipcRenderer)`
**Why bad:** Renderer can call any channel, bypass security.
**Instead:** Expose specific functions for specific operations only.

### Anti-Pattern 3: Sync IPC Calls

**What:** Using `ipcRenderer.sendSync()` for database calls.
**Why bad:** Blocks entire renderer, UI freezes.
**Instead:** Always use `invoke()` which is async.

### Anti-Pattern 4: CPU Work in Main Process

**What:** Heavy computation in main process IPC handlers.
**Why bad:** Blocks all windows, app freezes.
**Instead:** Use `utilityProcess` for heavy work, or keep main lightweight.

### Anti-Pattern 5: WebView for Embedded Content

**What:** Using `<webview>` tag for work mode browser.
**Why bad:** Deprecated, stability issues, architectural changes coming.
**Instead:** Use `WebContentsView` (requires BaseWindow) or sandboxed `<iframe>`.

## Recommended Folder Structure

```
src/
├── main/                      # Main process code
│   ├── index.ts               # Entry, creates window
│   ├── ipc/                   # IPC handler registration
│   │   ├── index.ts           # Register all handlers
│   │   ├── database.ts        # db:* channel handlers
│   │   └── claude.ts          # claude:* channel handlers
│   ├── db/                    # Database layer
│   │   ├── index.ts           # better-sqlite3 instance
│   │   ├── migrations/        # SQL migration files
│   │   └── repositories/      # Entity-specific queries
│   └── services/              # Business logic
│       └── claude.ts          # Claude CLI spawning
│
├── preload/                   # Preload scripts
│   ├── index.ts               # Main preload (contextBridge)
│   └── workmode.ts            # Separate preload for webview (if needed)
│
├── renderer/                  # React app
│   ├── index.html             # Entry HTML
│   ├── main.tsx               # React entry
│   ├── App.tsx                # Root component
│   ├── components/            # UI components
│   │   ├── ui/                # shadcn/ui components
│   │   └── features/          # Feature-specific components
│   ├── hooks/                 # Custom hooks
│   │   ├── useDatabase.ts     # Database query hooks
│   │   └── useClaudeStream.ts # Streaming hook
│   ├── stores/                # Zustand stores (if needed)
│   └── lib/                   # Utilities
│
├── shared/                    # Shared between processes
│   └── types/                 # TypeScript types
│       ├── api.ts             # IPC API types
│       └── entities.ts        # Domain entities
│
└── electron.vite.config.ts    # Build config
```

## Embedded Browser Options for Work Mode

| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| **iframe** | Simple, DOM-based, well-supported | Limited control, CSP restrictions | Use if target sites allow framing |
| **WebContentsView** | Best performance, full control | Not in DOM, complex positioning, requires BaseWindow | Use for maximum control |
| **webview** | Easy to use, DOM-based | Deprecated, stability issues | Avoid |

**Recommendation:** Start with `iframe` if CSP allows. If sites block framing or you need more control, move to `WebContentsView` with `BaseWindow`.

### WebContentsView Communication

```typescript
// main/workmode.ts
const workView = new WebContentsView({
  webPreferences: {
    preload: path.join(__dirname, '../preload/workmode.js'),
    contextIsolation: true,
    nodeIntegration: false,
  }
});
win.contentView.addChildView(workView);
workView.webContents.loadURL(url);

// Communication via dedicated IPC
workView.webContents.ipc.on('workmode:action', (event, data) => {
  // Handle action from work mode view
});
```

## Build Order Dependencies

```
Phase 1: Foundation
├── Electron shell + React skeleton
├── Preload script with typed API
└── Basic IPC plumbing

Phase 2: Data Layer
├── SQLite setup + migrations (main)
├── Repository pattern (main)
├── Database IPC handlers (main)
└── React Query/data hooks (renderer)

Phase 3: Core Features
├── Task CRUD UI
├── Task list views
└── Basic task management

Phase 4: AI Integration
├── Claude CLI spawner (main)
├── Streaming IPC (main → renderer)
├── Streaming UI hook (renderer)
└── Chat/assistant interface

Phase 5: Work Mode
├── Embedded browser (iframe or WebContentsView)
├── Work session state
└── Context switching
```

**Key Dependencies:**
- Phase 2 depends on Phase 1 (IPC must exist)
- Phase 3 depends on Phase 2 (CRUD needs database)
- Phase 4 can start after Phase 1 (parallel with Phase 2-3)
- Phase 5 depends on Phase 3 (needs task context)

## Security Configuration

```typescript
// main/index.ts
const mainWindow = new BrowserWindow({
  webPreferences: {
    nodeIntegration: false,          // CRITICAL: Never enable
    contextIsolation: true,          // CRITICAL: Always enable
    sandbox: true,                   // Recommended: Extra isolation
    preload: path.join(__dirname, '../preload/index.js'),
    webviewTag: false,               // Disable deprecated webview
  },
});
```

## Sources

**Official Electron Documentation (HIGH confidence):**
- [Inter-Process Communication](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [Process Model](https://www.electronjs.org/docs/latest/tutorial/process-model)
- [Security Best Practices](https://www.electronjs.org/docs/latest/tutorial/security)
- [Web Embeds](https://www.electronjs.org/docs/latest/tutorial/web-embeds)
- [utilityProcess API](https://www.electronjs.org/docs/latest/api/utility-process)
- [WebContentsView API](https://www.electronjs.org/docs/latest/api/web-contents-view)

**Community Patterns (MEDIUM confidence):**
- [electron-vite folder structure](https://electron-vite.org/guide/dev)
- [Figma BrowserView approach](https://www.figma.com/blog/introducing-browserview-for-electron/)
- [Streaming terminal output pattern](https://dev.to/taw/electron-adventures-episode-16-streaming-terminal-output-431g)
- [Better-SQLite3 integration](https://dev.to/arindam1997007/a-step-by-step-guide-to-integrating-better-sqlite3-with-electron-js-app-using-create-react-app-3k16)
