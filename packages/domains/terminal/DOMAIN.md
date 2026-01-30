# Terminal Domain

Manages PTY sessions for task execution. Supports multiple terminal modes (Claude Code, Codex, plain shell).

## Contracts (shared/)

```typescript
type TerminalMode = 'claude-code' | 'codex' | 'terminal'
type TerminalState = 'starting' | 'running' | 'idle' | 'awaiting_input' | 'error' | 'dead'
type CodeMode = 'normal' | 'plan' | 'accept-edits' | 'bypass'
```

## Main Process (main/)

- `registerPtyHandlers(ipcMain, db)` - PTY lifecycle (create, write, resize, kill)
- `registerClaudeHandlers(ipcMain)` - Claude Code availability check
- `PtyManager` - Session management, buffer caching, state detection
- Mode adapters for Claude Code, Codex, plain terminal

## Client (client/)

- `PtyProvider` / `usePty()` - React context for terminal state
- `Terminal` - xterm.js component with fit addon
- `TerminalStatusPopover` - Session state indicator

## Dependencies

None (foundational domain).
