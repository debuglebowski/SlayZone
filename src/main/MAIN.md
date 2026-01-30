# Main Process

Electron main process - Node.js environment with full system access.

## Entry Point

`index.ts` - Creates windows, registers IPC handlers, manages app lifecycle.

## Structure

```
main/
├── index.ts              # App entry, window creation, handler registration
├── db/
│   ├── index.ts          # Database singleton
│   └── migrations.ts     # Schema migrations
└── domains/
    ├── task/             # Task CRUD, AI, dependencies
    │   ├── DOMAIN.md
    │   ├── handlers.ts   # IPC handlers
    │   ├── ai.ts         # Description generation
    │   └── files.ts      # Temp file operations
    ├── projects/         # Project CRUD
    │   ├── DOMAIN.md
    │   └── handlers.ts
    ├── tags/             # Tag CRUD, task-tag links
    │   ├── DOMAIN.md
    │   └── handlers.ts
    ├── terminal/         # PTY lifecycle
    │   ├── DOMAIN.md
    │   ├── handlers.ts   # PTY IPC handlers
    │   ├── pty-manager.ts
    │   ├── ring-buffer.ts
    │   ├── claude.ts
    │   └── adapters/     # Mode-specific behavior
    └── settings/         # Preferences, theme
        ├── DOMAIN.md
        ├── handlers.ts
        └── theme.ts
```

## Handler Registration

All handlers registered in `index.ts` on `app.whenReady()`:

```typescript
registerTaskHandlers()      // domains/task/handlers.ts
registerAiHandlers()        // domains/task/ai.ts
registerFilesHandlers()     // domains/task/files.ts
registerProjectHandlers()   // domains/projects/handlers.ts
registerTagHandlers()       // domains/tags/handlers.ts
registerPtyHandlers()       // domains/terminal/handlers.ts
registerClaudeHandlers()    // domains/terminal/claude.ts
registerSettingsHandlers()  // domains/settings/handlers.ts
registerThemeHandlers()     // domains/settings/theme.ts
```

## Database

SQLite via better-sqlite3 (synchronous API).

**Location**: `~/.config/omgslayzone/` (platform-dependent)

**Tables**:
- `projects` - id, name, color, path
- `tasks` - id, project_id, title, description, status, priority, order, due_date, terminal_mode, ...
- `tags` - id, name, color
- `task_tags` - task_id, tag_id (junction)
- `task_dependencies` - task_id, blocks_task_id
- `settings` - key, value (KV store)

## PTY Management

`domains/terminal/pty-manager.ts` handles terminal session lifecycle:

1. **Create** - Spawns PTY with adapter-specific command
2. **Data** - Forwards output to renderer, detects activity/errors
3. **Kill** - SIGKILL for clean termination
4. **Idle** - Detects idle sessions for UI feedback

### Adapters

Each terminal mode has an adapter in `domains/terminal/adapters/`:

| Adapter | Mode | Purpose |
|---------|------|---------|
| `ClaudeAdapter` | `claude-code` | Claude CLI with `--resume` |
| `CodexAdapter` | `codex` | OpenAI Codex CLI |
| `ShellAdapter` | `terminal` | User's default shell |

## Cleanup

On `app.will-quit`:
- Stop idle checker
- Kill all PTY sessions
- Close database connection
