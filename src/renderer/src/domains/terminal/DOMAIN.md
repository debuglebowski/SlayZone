# Terminal Domain (Renderer)

Terminal rendering, PTY state management, CLI status display.

## Responsibilities

- xterm.js terminal rendering
- PTY context (manages per-task terminal state)
- Terminal output caching
- Activity status display (idle, thinking, tool_use)
- Session resume handling

## Exports

| Export | Type | Purpose |
|--------|------|---------|
| `Terminal` | Component | xterm.js wrapper |
| `TerminalStatusPopover` | Component | Status badge with popover |
| `PtyProvider` | Context | Per-task PTY state |
| `usePty` | Hook | Access PTY context |
| `usePtyStatus` | Hook | Terminal state/activity |

## Key Files

| File | Purpose |
|------|---------|
| `context/PtyContext.tsx` | Central PTY state, subscriptions |
| `components/Terminal.tsx` | xterm.js integration |
| `components/TerminalStatusPopover.tsx` | Status indicator |
| `components/terminal-cache.ts` | Output caching |
| `hooks/usePtyStatus.ts` | State tracking hook |

## State Shape (per taskId)

```typescript
{
  buffer: string           // Terminal output
  exitCode: number | null  // Process exit code
  sessionInvalid: boolean  // Claude session expired
  state: TerminalState     // starting/running/idle/dead
  pendingPrompt: PromptInfo | null
}
```

## Dependencies

- `@xterm/xterm` - Terminal emulator
- `@xterm/addon-fit` - Auto-resize
- `@xterm/addon-webgl` - GPU rendering
- `window.api.pty` - IPC to main process
