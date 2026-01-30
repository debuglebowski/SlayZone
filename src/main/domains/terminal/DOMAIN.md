# Terminal Domain (Main)

PTY lifecycle management and CLI adapter pattern.

## Responsibilities

- PTY creation/destruction per task
- Data streaming (input/output) between renderer and PTY
- Terminal resize handling
- Activity detection (idle, thinking, tool_use)
- Session resume for Claude Code
- CLI availability checks

## IPC Handlers

| Channel | Purpose |
|---------|---------|
| `pty:create` | Spawn PTY with adapter |
| `pty:write` | Send input to PTY |
| `pty:resize` | Handle terminal resize |
| `pty:kill` | Terminate PTY |
| `pty:exists` | Check if PTY alive |
| `pty:getBuffer` | Get terminal output buffer |
| `pty:list` | List active PTYs |
| `pty:getState` | Get terminal state |
| `claude:checkAvailability` | Check if Claude CLI installed |

## Events (to Renderer)

| Event | Purpose |
|-------|---------|
| `pty:data:{taskId}` | Terminal output |
| `pty:exit:{taskId}` | PTY exited |
| `pty:sessionNotFound:{taskId}` | Claude session invalid |
| `pty:idle:{taskId}` | Terminal went idle |
| `pty:state:{taskId}` | State changed |
| `pty:prompt:{taskId}` | Prompt detected |
| `pty:sessionDetected:{taskId}` | New session ID found |

## Adapters

Located in `adapters/`. Each implements `TerminalAdapter`:

| Adapter | Mode | Purpose |
|---------|------|---------|
| `ClaudeAdapter` | `claude-code` | Claude Code CLI with --resume |
| `CodexAdapter` | `codex` | OpenAI Codex CLI |
| `ShellAdapter` | `terminal` | Plain shell |

## Key Files

| File | Purpose |
|------|---------|
| `handlers.ts` | IPC handler registration |
| `pty-manager.ts` | PTY lifecycle, state machine |
| `ring-buffer.ts` | 300KB circular buffer per task |
| `claude.ts` | Claude-specific handlers |

## Types

```typescript
import type { TerminalMode, TerminalState, PtyInfo, ActivityState, CLIState } from '@shared/domains/terminal'
```

## Dependencies

- `node-pty` - Terminal emulation
- `../../db` - Settings and task config
