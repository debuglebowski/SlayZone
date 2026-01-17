# Phase 6: Work Mode - Research

**Researched:** 2026-01-17
**Domain:** Electron embedded content, workspace layouts, React state management
**Confidence:** HIGH

## Summary

Work Mode creates a focused workspace for deep work on a task, combining AI chat (from Phase 5), browser tabs, and living documents in a sidebar + main content layout. The key technical challenges are:

1. **Embedded browser tabs** - Must use Electron's webview tag since iframes are blocked by X-Frame-Options on most sites
2. **Workspace layout** - Sidebar for item list, main panel for active item content
3. **IPC handlers** - Need workspace_items CRUD to match existing pattern

The existing codebase provides strong foundations: ChatPanel component, MarkdownEditor component, workspace_items table schema, and established IPC patterns. Primary work is composing these into the Work Mode page and adding webview support.

**Primary recommendation:** Use webview tag for browser tabs (only option that works), reuse existing MarkdownEditor for documents, reuse ChatPanel for chat, add react-resizable-panels only if resizing is needed (start without it).

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| react-markdown | 10.1.0 | Markdown rendering | Installed |
| remark-gfm | 4.0.1 | GitHub Flavored Markdown | Installed |
| lucide-react | 0.562.0 | Icons | Installed |
| @radix-ui/* | Various | UI primitives | Installed |

### Needed for Phase 6
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | - | Webview is native Electron | Built-in |

### Optional If Resizing Needed
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-resizable-panels | ^2.x | Resizable split layouts | Only if spec requires drag-to-resize |

**No new dependencies required** - webview is native Electron, markdown already installed.

## Architecture Patterns

### Recommended Project Structure
```
src/renderer/src/components/
├── work-mode/
│   ├── WorkModePage.tsx        # Main container with sidebar + content
│   ├── WorkspaceSidebar.tsx    # Item list (chat, browser, document)
│   ├── WorkspaceItemCard.tsx   # Sidebar item with icon, name, context menu
│   ├── BrowserView.tsx         # Webview wrapper for browser tabs
│   └── DocumentEditor.tsx      # Wrapper around existing MarkdownEditor
└── chat/
    └── ChatPanel.tsx           # (existing) Reuse as-is
```

### Pattern 1: View State for Navigation
**What:** Extend existing ViewState union type in App.tsx
**When to use:** Adding Work Mode as third view type
**Example:**
```typescript
type ViewState =
  | { type: 'kanban' }
  | { type: 'task-detail'; taskId: string }
  | { type: 'work-mode'; taskId: string; activeItemId?: string }
```

### Pattern 2: Webview for Browser Tabs
**What:** Use Electron's webview tag with proper security settings
**When to use:** Embedding external websites in browser tabs
**Example:**
```typescript
// In main/index.ts - Enable webviewTag
new BrowserWindow({
  webPreferences: {
    webviewTag: true,  // Required for <webview>
    preload: join(__dirname, '../preload/index.js'),
    sandbox: true,
    contextIsolation: true,
    nodeIntegration: false
  }
})

// In renderer component
<webview
  src={url}
  style={{ width: '100%', height: '100%' }}
  partition="persist:browser-tabs"
/>
```

### Pattern 3: Workspace Items CRUD (IPC)
**What:** Follow existing db:entity:action IPC pattern
**When to use:** All workspace item operations
**Example:**
```typescript
// IPC handlers needed:
'db:workspaceItems:getByTask'    // Get all items for a task
'db:workspaceItems:create'       // Create new item
'db:workspaceItems:update'       // Rename, update content/url
'db:workspaceItems:delete'       // Delete item

// Input types (api.ts):
interface CreateWorkspaceItemInput {
  taskId: string
  type: 'chat' | 'browser' | 'document'
  name: string
  content?: string  // For documents
  url?: string      // For browser tabs
}

interface UpdateWorkspaceItemInput {
  id: string
  name?: string
  content?: string
  url?: string
}
```

### Anti-Patterns to Avoid
- **iframe for external sites:** X-Frame-Options will block most sites. Use webview.
- **webview without partition:** Creates separate session per webview. Use `partition="persist:browser-tabs"` to share session.
- **Custom markdown editor:** Already have MarkdownEditor component. Reuse it.
- **Complex state management:** Workspace items are simple CRUD. useState + useEffect is sufficient.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown editing | Custom editor | Existing MarkdownEditor | Already implemented with edit/view modes |
| AI chat | Custom chat UI | Existing ChatPanel | Already implements streaming, persistence |
| External site embedding | iframe | Electron webview | X-Frame-Options blocks iframes |
| Session persistence | Manual cookies | webview partition | Built-in Electron feature |

**Key insight:** Phase 5 and 4 already built the hard parts (ChatPanel, MarkdownEditor). Phase 6 is composition.

## Common Pitfalls

### Pitfall 1: iframe X-Frame-Options Blocking
**What goes wrong:** iframe fails to load most external sites due to X-Frame-Options header
**Why it happens:** Sites set `X-Frame-Options: DENY` or `SAMEORIGIN` for security
**How to avoid:** Use webview tag which runs in separate process and ignores these headers
**Warning signs:** Blank iframe, console errors about X-Frame-Options

### Pitfall 2: Webview Not Enabled
**What goes wrong:** `<webview>` renders as empty/broken element
**Why it happens:** webviewTag is disabled by default since Electron 5
**How to avoid:** Add `webviewTag: true` to BrowserWindow webPreferences
**Warning signs:** Console warning about webview being disabled

### Pitfall 3: Webview Sizing Issues
**What goes wrong:** Webview doesn't fill container or renders at 0x0
**Why it happens:** Webview uses `display: flex` internally, needs explicit dimensions
**How to avoid:** Use `display: inline-flex` and explicit width/height or flex parent
**Warning signs:** Invisible webview, layout shifts

### Pitfall 4: Chat Item Without workspaceItemId
**What goes wrong:** Chat messages not persisted, lost on refresh
**Why it happens:** ChatPanel requires workspaceItemId to save messages
**How to avoid:** Always create workspace_item row first, then pass ID to ChatPanel
**Warning signs:** Messages disappear after navigation

### Pitfall 5: Multiple Chat Sessions Colliding
**What goes wrong:** Stream events from one chat appear in another
**Why it happens:** useClaude subscribes to global IPC events
**How to avoid:** Current implementation is fine for single concurrent stream. If multiple chats needed, would need session IDs in events.
**Warning signs:** Chat responses appearing in wrong panel

## Code Examples

### Webview Component (BrowserView.tsx)
```typescript
// Source: Electron docs + project patterns
interface BrowserViewProps {
  url: string
  onNavigate?: (newUrl: string) => void
}

export function BrowserView({ url, onNavigate }: BrowserViewProps) {
  const webviewRef = useRef<Electron.WebviewTag>(null)

  useEffect(() => {
    const webview = webviewRef.current
    if (!webview) return

    const handleNavigate = (e: Electron.DidNavigateEvent) => {
      onNavigate?.(e.url)
    }

    webview.addEventListener('did-navigate', handleNavigate)
    return () => webview.removeEventListener('did-navigate', handleNavigate)
  }, [onNavigate])

  return (
    <webview
      ref={webviewRef}
      src={url}
      partition="persist:browser-tabs"
      className="w-full h-full"
      style={{ display: 'inline-flex' }}
    />
  )
}
```

### Workspace Item Creation
```typescript
// Source: Project IPC patterns
const handleAddItem = async (type: WorkspaceItemType) => {
  const defaultNames = {
    chat: 'Chat',
    browser: 'New Tab',
    document: 'Untitled'
  }

  const item = await window.api.workspaceItems.create({
    taskId,
    type,
    name: defaultNames[type],
    url: type === 'browser' ? 'https://google.com' : undefined,
    content: type === 'document' ? '' : undefined
  })

  setItems([...items, item])
  setActiveItemId(item.id)
}
```

### Document Editor Wrapper
```typescript
// Source: Existing MarkdownEditor pattern
interface DocumentEditorProps {
  item: WorkspaceItem
  onUpdate: (item: WorkspaceItem) => void
}

export function DocumentEditor({ item, onUpdate }: DocumentEditorProps) {
  const [content, setContent] = useState(item.content ?? '')

  const handleSave = async () => {
    const updated = await window.api.workspaceItems.update({
      id: item.id,
      content
    })
    onUpdate(updated)
  }

  return (
    <MarkdownEditor
      value={content}
      onChange={setContent}
      onSave={handleSave}
      placeholder="Start writing..."
    />
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| webview default enabled | webviewTag: true required | Electron 5 | Must explicitly enable |
| iframe for embedding | webview or WebContentsView | Ongoing | X-Frame-Options blocking |
| Custom split panes | react-resizable-panels | 2023+ | Standard library if needed |

**Deprecated/outdated:**
- `@electron/remote` - Avoid, use IPC instead (project already does this correctly)
- webview `nodeintegration` - Never enable for security
- webview without partition - Creates memory issues with multiple webviews

## API Changes Needed

### New IPC Handlers (database.ts)
```typescript
// Workspace Items
ipcMain.handle('db:workspaceItems:getByTask', (_, taskId: string) => {
  return db.prepare('SELECT * FROM workspace_items WHERE task_id = ? ORDER BY created_at')
    .all(taskId)
})

ipcMain.handle('db:workspaceItems:create', (_, data: CreateWorkspaceItemInput) => {
  const id = crypto.randomUUID()
  db.prepare(`
    INSERT INTO workspace_items (id, task_id, type, name, content, url)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, data.taskId, data.type, data.name, data.content ?? null, data.url ?? null)
  return db.prepare('SELECT * FROM workspace_items WHERE id = ?').get(id)
})

ipcMain.handle('db:workspaceItems:update', (_, data: UpdateWorkspaceItemInput) => {
  const fields: string[] = []
  const values: unknown[] = []

  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name) }
  if (data.content !== undefined) { fields.push('content = ?'); values.push(data.content) }
  if (data.url !== undefined) { fields.push('url = ?'); values.push(data.url) }

  if (fields.length > 0) {
    fields.push("updated_at = datetime('now')")
    values.push(data.id)
    db.prepare(`UPDATE workspace_items SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  }
  return db.prepare('SELECT * FROM workspace_items WHERE id = ?').get(data.id)
})

ipcMain.handle('db:workspaceItems:delete', (_, id: string) => {
  const result = db.prepare('DELETE FROM workspace_items WHERE id = ?').run(id)
  return result.changes > 0
})
```

### New API Types (api.ts)
```typescript
import type { WorkspaceItem, WorkspaceItemType } from './database'

interface CreateWorkspaceItemInput {
  taskId: string
  type: WorkspaceItemType
  name: string
  content?: string
  url?: string
}

interface UpdateWorkspaceItemInput {
  id: string
  name?: string
  content?: string
  url?: string
}

// Add to ElectronAPI:
workspaceItems: {
  getByTask: (taskId: string) => Promise<WorkspaceItem[]>
  create: (data: CreateWorkspaceItemInput) => Promise<WorkspaceItem>
  update: (data: UpdateWorkspaceItemInput) => Promise<WorkspaceItem>
  delete: (id: string) => Promise<boolean>
}
```

## Open Questions

1. **Browser tab URL input UX** - Modal for new URL? Inline editable? Address bar in content area?
2. **Webview navigation controls** - Include back/forward/refresh buttons? Or just display URL?
3. **Default workspace items** - Auto-create "Chat" item when entering Work Mode? Or empty initially?
4. **Sidebar width** - Fixed width or resizable? Spec shows fixed narrow sidebar.

## Sources

### Primary (HIGH confidence)
- Electron Web Embeds docs: https://www.electronjs.org/docs/latest/tutorial/web-embeds
- Electron webview tag API: https://www.electronjs.org/docs/latest/api/webview-tag
- Electron Security docs: https://www.electronjs.org/docs/latest/tutorial/security
- Project codebase (migrations.ts, database.ts, ChatPanel.tsx, MarkdownEditor.tsx)

### Secondary (MEDIUM confidence)
- react-resizable-panels: https://github.com/bvaughn/react-resizable-panels

### Tertiary (LOW confidence)
- None - all findings verified with official sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - verified against project package.json and Electron docs
- Architecture: HIGH - based on existing project patterns and Electron official docs
- Pitfalls: HIGH - documented in Electron official docs and GitHub issues

**Research date:** 2026-01-17
**Valid until:** 2026-02-17 (Electron API stable)
