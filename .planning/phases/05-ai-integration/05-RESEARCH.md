# Phase 5: AI Integration - Research

**Researched:** 2026-01-17
**Domain:** Claude CLI spawning, stdout streaming, Electron IPC, chat UI
**Confidence:** HIGH

## Summary

Phase 5 integrates Claude CLI into the desktop app via child process spawning. The app spawns `claude -p` with task context, receives streaming NDJSON output via stdout, and forwards chunks through IPC to the React renderer for real-time display.

The approach uses Node.js `child_process.spawn()` in Electron's main process with `--output-format stream-json` flag for NDJSON output. Each line is a complete JSON object parsed independently. The preload script exposes callback-based streaming API (not Promise) with proper cleanup functions for cancellation.

**Primary recommendation:** Use `claude -p --output-format stream-json` with newline-based parsing, store messages in dedicated `chat_messages` table linked to workspace items.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| child_process (Node built-in) | N/A | Spawn Claude CLI | Native, async, streaming support |
| readline (Node built-in) | N/A | Parse NDJSON lines | Built-in line-based stream parsing |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ndjson | 2.0.0 | Transform stream for NDJSON | Optional - readline sufficient for simple cases |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| child_process.spawn | utilityProcess | utilityProcess is Chromium-based, spawn is simpler for CLI spawning |
| readline | manual split('\n') | readline handles partial chunks, edge cases |
| ndjson library | readline | ndjson adds dependency but handles more edge cases |

**Installation:**
```bash
# No additional dependencies needed - all built-in Node.js
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── main/
│   ├── ipc/
│   │   ├── database.ts      # Existing db handlers
│   │   └── claude.ts        # NEW: claude:* channel handlers
│   └── services/
│       └── claude-spawner.ts # NEW: Claude CLI spawn + streaming logic
│
├── preload/
│   └── index.ts             # Add claude API to ElectronAPI
│
├── renderer/src/
│   ├── hooks/
│   │   └── useClaude.ts     # NEW: Streaming state hook
│   └── components/
│       └── chat/            # NEW: Chat UI components
│           ├── ChatPanel.tsx
│           ├── ChatMessage.tsx
│           └── ChatInput.tsx
│
└── shared/types/
    └── api.ts               # Extend with claude API types
```

### Pattern 1: Streaming IPC with Callbacks

**What:** Main process sends chunks via `webContents.send()`, renderer listens via preload callback
**When to use:** Any streaming data from main to renderer
**Example:**
```typescript
// main/services/claude-spawner.ts
import { spawn, ChildProcess } from 'child_process'
import { createInterface } from 'readline'
import { BrowserWindow } from 'electron'

let activeProcess: ChildProcess | null = null

export function streamClaude(
  win: BrowserWindow,
  prompt: string,
  context?: string
): void {
  // Build args
  const args = ['-p', '--output-format', 'stream-json']
  if (context) {
    args.push('--append-system-prompt', context)
  }
  args.push(prompt)

  // Spawn process
  activeProcess = spawn('claude', args, {
    stdio: ['ignore', 'pipe', 'pipe']
  })

  // Parse NDJSON from stdout
  const rl = createInterface({ input: activeProcess.stdout! })

  rl.on('line', (line) => {
    try {
      const data = JSON.parse(line)
      win.webContents.send('claude:chunk', data)
    } catch {
      // Skip non-JSON lines
    }
  })

  activeProcess.stderr?.on('data', (data) => {
    win.webContents.send('claude:error', data.toString())
  })

  activeProcess.on('close', (code) => {
    win.webContents.send('claude:done', { code })
    activeProcess = null
  })
}

export function cancelClaude(): boolean {
  if (activeProcess) {
    activeProcess.kill('SIGTERM')
    activeProcess = null
    return true
  }
  return false
}
```

### Pattern 2: Typed Preload with Streaming Callbacks

**What:** Expose streaming API via contextBridge with callback registration
**When to use:** Main-to-renderer streaming communication
**Example:**
```typescript
// preload/index.ts (additions)
const api: ElectronAPI = {
  // ... existing db, tags, taskTags, settings ...

  claude: {
    stream: (prompt: string, context?: string) => {
      return ipcRenderer.invoke('claude:stream:start', prompt, context)
    },
    cancel: () => {
      ipcRenderer.send('claude:stream:cancel')
    },
    onChunk: (callback: (data: ClaudeStreamEvent) => void) => {
      const handler = (_event: unknown, data: ClaudeStreamEvent) => callback(data)
      ipcRenderer.on('claude:chunk', handler)
      return () => ipcRenderer.removeListener('claude:chunk', handler)
    },
    onError: (callback: (error: string) => void) => {
      const handler = (_event: unknown, error: string) => callback(error)
      ipcRenderer.on('claude:error', handler)
      return () => ipcRenderer.removeListener('claude:error', handler)
    },
    onDone: (callback: (result: { code: number }) => void) => {
      const handler = (_event: unknown, result: { code: number }) => callback(result)
      ipcRenderer.on('claude:done', handler)
      return () => ipcRenderer.removeListener('claude:done', handler)
    }
  }
}
```

### Pattern 3: React Hook for Streaming State

**What:** useReducer-based hook accumulating stream chunks
**When to use:** Any streaming UI that needs to show partial results
**Example:**
```typescript
// renderer/hooks/useClaude.ts
import { useReducer, useCallback, useEffect } from 'react'

type StreamStatus = 'idle' | 'streaming' | 'done' | 'error' | 'cancelled'

interface StreamState {
  status: StreamStatus
  content: string
  error: string | null
}

type StreamAction =
  | { type: 'START' }
  | { type: 'CHUNK'; text: string }
  | { type: 'DONE' }
  | { type: 'ERROR'; error: string }
  | { type: 'CANCEL' }
  | { type: 'RESET' }

function streamReducer(state: StreamState, action: StreamAction): StreamState {
  switch (action.type) {
    case 'START':
      return { status: 'streaming', content: '', error: null }
    case 'CHUNK':
      return { ...state, content: state.content + action.text }
    case 'DONE':
      return { ...state, status: 'done' }
    case 'ERROR':
      return { ...state, status: 'error', error: action.error }
    case 'CANCEL':
      return { ...state, status: 'cancelled' }
    case 'RESET':
      return { status: 'idle', content: '', error: null }
    default:
      return state
  }
}

export function useClaude() {
  const [state, dispatch] = useReducer(streamReducer, {
    status: 'idle',
    content: '',
    error: null
  })

  useEffect(() => {
    const unsubChunk = window.api.claude.onChunk((data) => {
      // Extract text from stream-json format
      if (data.type === 'assistant' && data.message?.content) {
        for (const block of data.message.content) {
          if (block.type === 'text') {
            dispatch({ type: 'CHUNK', text: block.text })
          }
        }
      }
    })

    const unsubError = window.api.claude.onError((error) => {
      dispatch({ type: 'ERROR', error })
    })

    const unsubDone = window.api.claude.onDone(() => {
      dispatch({ type: 'DONE' })
    })

    return () => {
      unsubChunk()
      unsubError()
      unsubDone()
    }
  }, [])

  const stream = useCallback((prompt: string, context?: string) => {
    dispatch({ type: 'START' })
    window.api.claude.stream(prompt, context)
  }, [])

  const cancel = useCallback(() => {
    window.api.claude.cancel()
    dispatch({ type: 'CANCEL' })
  }, [])

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' })
  }, [])

  return { ...state, stream, cancel, reset }
}
```

### Anti-Patterns to Avoid

- **Returning Promise for streaming:** `invoke()` returns single value; use `send()/on()` for multiple events
- **Exposing raw ipcRenderer:** Security risk; wrap in typed functions
- **Not cleaning up listeners:** Memory leak; return unsubscribe function
- **Blocking main process:** spawn is async, but parsing shouldn't block
- **Ignoring stderr:** Claude CLI may emit errors/warnings to stderr

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| NDJSON parsing | Manual string split | readline createInterface | Handles partial chunks, buffer boundaries |
| Process cleanup | Manual signal handling | SIGTERM + activeProcess tracking | OS handles child cleanup on SIGTERM |
| Stream text accumulation | useState with concatenation | useReducer | Batched updates, cleaner state transitions |
| Typewriter animation | setInterval character-by-character | Raw chunk append | Claude already streams; no artificial delay needed |

**Key insight:** Claude CLI with `--output-format stream-json` handles the streaming complexity. Focus on reliable parsing and IPC forwarding, not re-implementing streaming logic.

## Common Pitfalls

### Pitfall 1: Promise-Based Streaming API

**What goes wrong:** Using `invoke()` for streaming waits for process completion, no incremental updates
**Why it happens:** Natural to reach for `invoke()` for all IPC
**How to avoid:** Use `handle()` only to start stream, `send()/on()` for chunks
**Warning signs:** UI updates only after full response

### Pitfall 2: Listener Leak on Component Unmount

**What goes wrong:** IPC listeners accumulate, causing duplicate messages and memory leaks
**Why it happens:** Not returning cleanup function from useEffect
**How to avoid:** Store `removeListener` function, call in cleanup
**Warning signs:** Multiple messages received per chunk, messages after navigation

### Pitfall 3: Partial JSON Line Parsing Failure

**What goes wrong:** JSON.parse fails on incomplete line
**Why it happens:** stdout data events don't guarantee line boundaries
**How to avoid:** Use `readline.createInterface()` which buffers until newline
**Warning signs:** Intermittent parse errors in console

### Pitfall 4: Process Not Cleaned Up on Window Close

**What goes wrong:** Claude process continues running after app closed
**Why it happens:** spawn creates detached process
**How to avoid:** Track active process, kill on `will-quit` event
**Warning signs:** Multiple `claude` processes in activity monitor

### Pitfall 5: Missing stream-json Flag

**What goes wrong:** Output arrives all at once, not streaming
**Why it happens:** Default output format is `text` (waits for completion)
**How to avoid:** Always include `--output-format stream-json`
**Warning signs:** Long delay, then full response at once

## Code Examples

### Claude CLI Stream-JSON Output Format

```bash
# Command to run:
claude -p --output-format stream-json "Explain recursion briefly"
```

Expected NDJSON output (one JSON per line):
```json
{"type":"system","subtype":"init","session_id":"...","model":"..."}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"Rec"}]}}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"ursion"}]}}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":" is when a function"}]}}
{"type":"result","subtype":"success","session_id":"...","cost":...}
```

### IPC Handler Registration

```typescript
// main/ipc/claude.ts
import { ipcMain, BrowserWindow } from 'electron'
import { streamClaude, cancelClaude } from '../services/claude-spawner'

export function registerClaudeHandlers(): void {
  ipcMain.handle('claude:stream:start', (event, prompt: string, context?: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      streamClaude(win, prompt, context)
    }
  })

  ipcMain.on('claude:stream:cancel', () => {
    cancelClaude()
  })
}
```

### Database Schema for Chat Persistence

```sql
-- Migration: Add chat_messages table
CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY,
  workspace_item_id TEXT NOT NULL REFERENCES workspace_items(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_chat_messages_workspace ON chat_messages(workspace_item_id);
```

### Building Task Context String

```typescript
// Helper to build context from task
function buildTaskContext(task: Task, subtasks: Task[]): string {
  const lines = [
    `Current task: ${task.title}`,
    `Status: ${task.status}`,
    `Priority: P${task.priority}`
  ]

  if (task.description) {
    lines.push(`Description: ${task.description}`)
  }

  if (task.due_date) {
    lines.push(`Due: ${task.due_date}`)
  }

  if (subtasks.length > 0) {
    lines.push('Subtasks:')
    for (const st of subtasks) {
      lines.push(`- [${st.status}] ${st.title}`)
    }
  }

  return lines.join('\n')
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Polling for output | Stream with NDJSON | Claude CLI 2024+ | Real-time updates |
| Text output format | stream-json format | Claude CLI 2024+ | Structured parsing |
| Manual line buffering | readline module | Always available | Simpler code |

**Current Claude CLI flags for SDK usage:**
- `-p` / `--print`: Non-interactive mode
- `--output-format stream-json`: NDJSON streaming
- `--append-system-prompt`: Add context without replacing defaults
- `--max-turns N`: Limit agentic loops
- `--max-budget-usd N`: Spending cap

## Open Questions

1. **Session persistence:** Does app need to support `claude -c` (continue) for multi-turn within same session? Current design: new session per chat item.

2. **Message type granularity:** Should we store raw NDJSON events or just final text? Recommendation: Store only human-readable content, not stream events.

3. **Context size limits:** How much task context before hitting token limits? Recommendation: Title + description + subtask titles should be safe (<1K tokens).

## Sources

### Primary (HIGH confidence)
- [Claude CLI Reference](https://code.claude.com/docs/en/cli-reference) - Official docs for all flags
- [Electron IPC Tutorial](https://www.electronjs.org/docs/latest/tutorial/ipc) - Official streaming patterns
- [Node.js child_process](https://nodejs.org/api/child_process.html) - spawn() documentation
- [Node.js readline](https://nodejs.org/api/readline.html) - Line-by-line parsing

### Secondary (MEDIUM confidence)
- [ndjson npm package](https://www.npmjs.com/package/ndjson) - Stream transform for NDJSON
- [Electron utilityProcess](https://www.electronjs.org/docs/latest/api/utility-process) - Alternative to spawn

### Tertiary (LOW confidence)
- Community examples of Claude CLI integration - Patterns vary

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All Node.js built-ins, well documented
- Architecture: HIGH - Follows established Electron IPC patterns from prior phases
- Claude CLI flags: HIGH - Verified from official docs
- Pitfalls: MEDIUM - Based on common patterns, not all personally verified

**Research date:** 2026-01-17
**Valid until:** 30 days (CLI flags may change with updates)
