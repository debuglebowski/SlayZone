# Tauri Migration Plan

## Context

Migrate SlayZone from Electron to Tauri 2.x. Motivation: smaller binary (~10MB vs ~200MB), lower memory, no bundled Chromium, Rust backend safety. Strategy: **parallel development** — `src-tauri/` alongside existing Electron code, React frontend shared.

Choices: **Pure Rust backend**, **full feature parity**, **parallel codebase**.

## Scope

- **~153 IPC methods** across 21 namespaces (`ElectronAPI` in `packages/shared/types/src/api.ts`)
- **16 event channels** (see [Event Channels](#event-channels))
- **34 SQL migrations** (`packages/apps/app/src/main/db/migrations.ts`)
- **PTY management** (node-pty → portable-pty)
- **MCP server** (HTTP+SSE, `packages/apps/app/src/main/mcp-server.ts`)
- **Linear integration** (GraphQL API)
- **File watching** (chokidar → notify)
- **Credentials** (Electron safeStorage → OS keyring)
- **Diagnostics** (IPC instrumentation, redaction, retention)

---

## Current Handler Registry

### 1. projects (`packages/domains/projects/src/main/handlers.ts`) — 4 handlers
| Channel | Signature |
|---------|-----------|
| `db:projects:getAll` | `() → Project[]` |
| `db:projects:create` | `(data: CreateProjectInput) → Project` |
| `db:projects:update` | `(data: UpdateProjectInput) → Project` |
| `db:projects:delete` | `(id: string) → boolean` |

### 2. tasks (`packages/domains/task/src/main/handlers.ts`) — 17 handlers
| Channel | Signature |
|---------|-----------|
| `db:tasks:getAll` | `() → Task[]` |
| `db:tasks:getByProject` | `(projectId) → Task[]` |
| `db:tasks:get` | `(id) → Task \| null` |
| `db:tasks:getSubTasks` | `(parentId) → Task[]` |
| `db:tasks:create` | `(data: CreateTaskInput) → Task` |
| `db:tasks:update` | `(data: UpdateTaskInput) → Task` |
| `db:tasks:delete` | `(id) → boolean` |
| `db:tasks:archive` | `(id) → Task` |
| `db:tasks:archiveMany` | `(ids: string[]) → void` |
| `db:tasks:unarchive` | `(id) → Task` |
| `db:tasks:getArchived` | `() → Task[]` |
| `db:tasks:reorder` | `(taskIds: string[]) → void` |
| `db:taskDependencies:getBlockers` | `(taskId) → Task[]` |
| `db:taskDependencies:getBlocking` | `(taskId) → Task[]` |
| `db:taskDependencies:addBlocker` | `(taskId, blockerTaskId) → void` |
| `db:taskDependencies:removeBlocker` | `(taskId, blockerTaskId) → void` |
| `db:taskDependencies:setBlockers` | `(taskId, blockerTaskIds[]) → void` |

### 3. tags (`packages/domains/tags/src/main/handlers.ts`) — 6 handlers
| Channel | Signature |
|---------|-----------|
| `db:tags:getAll` | `() → Tag[]` |
| `db:tags:create` | `(data: CreateTagInput) → Tag` |
| `db:tags:update` | `(data: UpdateTagInput) → Tag` |
| `db:tags:delete` | `(id) → boolean` |
| `db:taskTags:getForTask` | `(taskId) → Tag[]` |
| `db:taskTags:setForTask` | `(taskId, tagIds[]) → void` |

### 4. settings (`packages/domains/settings/src/main/handlers.ts`) — 3 handlers
| Channel | Signature |
|---------|-----------|
| `db:settings:get` | `(key) → string \| null` |
| `db:settings:set` | `(key, value) → void` |
| `db:settings:getAll` | `() → Record<string, string>` |

### 5. terminal (`packages/domains/terminal/src/main/handlers.ts`) — 10 handlers
| Channel | Signature |
|---------|-----------|
| `pty:create` | `(sessionId, cwd, conversationId?, existingConversationId?, mode?, initialPrompt?, codeMode?, providerFlags?) → {success, error?}` |
| `pty:write` | `(sessionId, data) → boolean` |
| `pty:resize` | `(sessionId, cols, rows) → boolean` |
| `pty:kill` | `(sessionId) → boolean` |
| `pty:exists` | `(sessionId) → boolean` |
| `pty:getBuffer` | `(sessionId) → string \| null` |
| `pty:clearBuffer` | `(sessionId) → {success, clearedSeq}` |
| `pty:getBufferSince` | `(sessionId, afterSeq) → BufferSinceResult \| null` |
| `pty:list` | `() → PtyInfo[]` |
| `pty:getState` | `(sessionId) → TerminalState \| null` |

### 6. task-terminals (`packages/domains/task-terminals/src/main/handlers.ts`) — 5 handlers
| Channel | Signature |
|---------|-----------|
| `tabs:list` | `(taskId) → TerminalTab[]` |
| `tabs:create` | `(input: CreateTerminalTabInput) → TerminalTab` |
| `tabs:update` | `(input: UpdateTerminalTabInput) → TerminalTab \| null` |
| `tabs:delete` | `(tabId) → boolean` |
| `tabs:ensureMain` | `(taskId, mode) → TerminalTab` |

### 7. worktrees/git (`packages/domains/worktrees/src/main/handlers.ts`) — 26 handlers
| Channel | Signature |
|---------|-----------|
| `git:isGitRepo` | `(path) → boolean` |
| `git:detectWorktrees` | `(repoPath) → DetectedWorktree[]` |
| `git:createWorktree` | `(repoPath, targetPath, branch?) → void` |
| `git:removeWorktree` | `(repoPath, worktreePath) → void` |
| `git:init` | `(path) → void` |
| `git:getCurrentBranch` | `(path) → string \| null` |
| `git:listBranches` | `(path) → string[]` |
| `git:checkoutBranch` | `(path, branch) → void` |
| `git:createBranch` | `(path, branch) → void` |
| `git:hasUncommittedChanges` | `(path) → boolean` |
| `git:mergeIntoParent` | `(projectPath, parentBranch, sourceBranch) → MergeResult` |
| `git:abortMerge` | `(path) → void` |
| `git:mergeWithAI` | `(projectPath, worktreePath, parentBranch, sourceBranch) → MergeWithAIResult` |
| `git:isMergeInProgress` | `(path) → boolean` |
| `git:getConflictedFiles` | `(path) → string[]` |
| `git:getWorkingDiff` | `(path) → GitDiffSnapshot` |
| `git:stageFile` | `(path, filePath) → void` |
| `git:unstageFile` | `(path, filePath) → void` |
| `git:discardFile` | `(path, filePath) → void` |
| `git:stageAll` | `(path) → void` |
| `git:unstageAll` | `(path) → void` |
| `git:getUntrackedFileDiff` | `(repoPath, filePath) → string` |
| `git:getConflictContent` | `(repoPath, filePath) → ConflictFileContent` |
| `git:writeResolvedFile` | `(repoPath, filePath, content) → void` |
| `git:commitFiles` | `(repoPath, message) → void` |
| `git:analyzeConflict` | `(mode, filePath, base, ours, theirs) → ConflictAnalysis` |

### 8. ai-config (`packages/domains/ai-config/src/main/handlers.ts`) — 32 handlers
| Channel | Signature |
|---------|-----------|
| `ai-config:list-items` | `(input: ListAiConfigItemsInput) → AiConfigItem[]` |
| `ai-config:get-item` | `(id) → AiConfigItem \| null` |
| `ai-config:create-item` | `(input: CreateAiConfigItemInput) → AiConfigItem` |
| `ai-config:update-item` | `(input: UpdateAiConfigItemInput) → AiConfigItem \| null` |
| `ai-config:delete-item` | `(id) → boolean` |
| `ai-config:list-project-selections` | `(projectId) → AiConfigProjectSelection[]` |
| `ai-config:set-project-selection` | `(input: SetAiConfigProjectSelectionInput) → void` |
| `ai-config:remove-project-selection` | `(projectId, itemId) → boolean` |
| `ai-config:discover-context-files` | `(projectPath) → ContextFileInfo[]` |
| `ai-config:read-context-file` | `(filePath, projectPath) → string` |
| `ai-config:write-context-file` | `(filePath, content, projectPath) → void` |
| `ai-config:get-context-tree` | `(projectPath, projectId) → ContextTreeEntry[]` |
| `ai-config:load-global-item` | `(input: LoadGlobalItemInput) → ContextTreeEntry` |
| `ai-config:sync-linked-file` | `(projectId, projectPath, itemId) → ContextTreeEntry` |
| `ai-config:unlink-file` | `(projectId, itemId) → boolean` |
| `ai-config:rename-context-file` | `(oldPath, newPath, projectPath) → void` |
| `ai-config:delete-context-file` | `(filePath, projectPath, projectId) → void` |
| `ai-config:discover-mcp-configs` | `(projectPath) → McpConfigFileResult[]` |
| `ai-config:write-mcp-server` | `(input: WriteMcpServerInput) → void` |
| `ai-config:remove-mcp-server` | `(input: RemoveMcpServerInput) → void` |
| `ai-config:list-providers` | `() → CliProviderInfo[]` |
| `ai-config:toggle-provider` | `(id, enabled) → void` |
| `ai-config:get-project-providers` | `(projectId) → CliProvider[]` |
| `ai-config:set-project-providers` | `(projectId, providers[]) → void` |
| `ai-config:needs-sync` | `(projectId, projectPath) → boolean` |
| `ai-config:sync-all` | `(input: SyncAllInput) → SyncResult` |
| `ai-config:check-sync-status` | `(projectId, projectPath) → SyncConflict[]` |
| `ai-config:get-global-instructions` | `() → string` |
| `ai-config:save-global-instructions` | `(content) → void` |
| `ai-config:get-root-instructions` | `(projectId, projectPath) → RootInstructionsResult` |
| `ai-config:save-root-instructions` | `(projectId, projectPath, content) → RootInstructionsResult` |
| `ai-config:get-project-skills-status` | `(projectId, projectPath) → ProjectSkillStatus[]` |

### 9. file-editor (`packages/domains/file-editor/src/main/handlers.ts`) — 10 handlers
| Channel | Signature |
|---------|-----------|
| `fs:readDir` | `(rootPath, dirPath) → DirEntry[]` |
| `fs:readFile` | `(rootPath, filePath, force?) → ReadFileResult` |
| `fs:writeFile` | `(rootPath, filePath, content) → void` |
| `fs:createFile` | `(rootPath, filePath) → void` |
| `fs:createDir` | `(rootPath, dirPath) → void` |
| `fs:rename` | `(rootPath, oldPath, newPath) → void` |
| `fs:delete` | `(rootPath, targetPath) → void` |
| `fs:listAllFiles` | `(rootPath) → string[]` |
| `fs:watch` | `(rootPath) → void` |
| `fs:unwatch` | `(rootPath) → void` |

### 10. integrations (`packages/domains/integrations/src/main/handlers.ts`) — 12 handlers
| Channel | Signature |
|---------|-----------|
| `integrations:connect-linear` | `(input: ConnectLinearInput) → IntegrationConnectionPublic` |
| `integrations:list-connections` | `(provider?) → IntegrationConnectionPublic[]` |
| `integrations:disconnect` | `(connectionId) → boolean` |
| `integrations:list-linear-teams` | `(connectionId) → LinearTeam[]` |
| `integrations:list-linear-projects` | `(connectionId, teamId) → LinearProject[]` |
| `integrations:list-linear-issues` | `(input: ListLinearIssuesInput) → {issues, nextCursor}` |
| `integrations:set-project-mapping` | `(input: SetProjectMappingInput) → IntegrationProjectMapping` |
| `integrations:get-project-mapping` | `(projectId, provider) → IntegrationProjectMapping \| null` |
| `integrations:import-linear-issues` | `(input: ImportLinearIssuesInput) → ImportLinearIssuesResult` |
| `integrations:sync-now` | `(input: SyncNowInput) → SyncNowResult` |
| `integrations:get-link` | `(taskId, provider) → ExternalLink \| null` |
| `integrations:unlink-task` | `(taskId, provider) → boolean` |

### 11. screenshot (`packages/apps/app/src/main/screenshot.ts`) — 1 handler
| Channel | Signature |
|---------|-----------|
| `screenshot:captureRegion` | `(rect: {x,y,width,height}) → {success, path?}` |

### 12. Inline handlers (`packages/apps/app/src/main/index.ts`) — 6 handlers
| Channel | Signature |
|---------|-----------|
| `shell:open-external` | `(url) → void` |
| `app:getVersion` | `() → string` |
| `window:close` | `() → void` |
| `dialog:showOpenDialog` | `(options) → {canceled, filePaths[]}` |
| `files:saveTempImage` | `(base64, mimeType) → {success, path?, error?}` |
| `files:pathExists` | `(path) → boolean` |

### 13. diagnostics (`packages/domains/diagnostics/src/main/service.ts`) — 5 handlers
| Channel | Signature |
|---------|-----------|
| `diagnostics:getConfig` | `() → DiagnosticsConfig` |
| `diagnostics:setConfig` | `(config: Partial<DiagnosticsConfig>) → DiagnosticsConfig` |
| `diagnostics:export` | `(request: DiagnosticsExportRequest) → DiagnosticsExportResult` |
| `diagnostics:recordClientError` | `(input: ClientErrorEventInput) → void` |
| `diagnostics:recordClientEvent` | `(input: ClientDiagnosticEventInput) → void` |

### 14. theme (`packages/domains/settings/src/main/handlers.ts`) — 3 handlers
| Channel | Signature |
|---------|-----------|
| `theme:get-effective` | `() → Theme` |
| `theme:get-source` | `() → ThemePreference` |
| `theme:set` | `(theme: ThemePreference) → Theme` |

### 15. claude/ai — 2 handlers
| Channel | Signature |
|---------|-----------|
| `claude:check-availability` | `() → ClaudeAvailability` |
| `ai:generate-description` | `(title, mode) → GenerateDescriptionResult` |

---

## Event Channels

| Channel | Direction | Payload | Source |
|---------|-----------|---------|--------|
| `pty:data` | main→renderer | `(sessionId, data, seq)` | PTY output |
| `pty:exit` | main→renderer | `(sessionId, exitCode)` | PTY process exit |
| `pty:state-change` | main→renderer | `(sessionId, newState, oldState)` | State machine transition |
| `pty:prompt` | main→renderer | `(sessionId, promptInfo)` | AI prompt detected |
| `pty:session-detected` | main→renderer | `(sessionId, conversationId)` | Resume session ID found |
| `pty:dev-server-detected` | main→renderer | `(sessionId, url)` | Dev server URL in output |
| `pty:session-not-found` | main→renderer | `(sessionId)` | Resume failed |
| `pty:attention` | main→renderer | `(sessionId)` | Needs user attention |
| `theme:changed` | main→renderer | `(theme: 'light'\|'dark')` | OS theme change |
| `tasks:changed` | main→renderer | `()` | DB mutation (MCP/sync) |
| `fs:changed` | main→renderer | `(rootPath, relPath)` | File watcher event |
| `app:go-home` | main→renderer | `()` | Cmd+§ shortcut |
| `app:open-settings` | main→renderer | `()` | Cmd+, shortcut |
| `app:open-project-settings` | main→renderer | `()` | Cmd+Shift+, shortcut |
| `app:close-task` | main→renderer | `(taskId)` | MCP close command |
| `app:screenshot-trigger` | main→renderer | `()` | Cmd+Shift+S shortcut |

---

## Rust Architecture

### Cargo Dependencies
```toml
[dependencies]
tauri = { version = "2", features = ["tray-icon", "dialog", "shell-open-api"] }
rusqlite = { version = "0.32", features = ["bundled"] }
portable-pty = "0.8"
reqwest = { version = "0.12", features = ["json"] }
keyring = "3"
notify = "7"
axum = "0.8"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
uuid = { version = "1", features = ["v4"] }
thiserror = "2"
comrak = "0.32"
git2 = "0.19"
walkdir = "2"
regex = "1"
chrono = { version = "0.4", features = ["serde"] }
```

### Module Structure
```
src-tauri/src/
├── main.rs              # entry, state init, command registration
├── state.rs             # AppState
├── error.rs             # thiserror enum, Serialize for frontend
├── db/
│   ├── mod.rs
│   └── migrations.rs    # 34 migrations as SQL strings
├── commands/
│   ├── mod.rs           # re-exports all command fns
│   ├── projects.rs      # 4 commands
│   ├── tasks.rs         # 17 commands (incl deps)
│   ├── tags.rs          # 6 commands (tags + taskTags)
│   ├── settings.rs      # 3 commands
│   ├── theme.rs         # 3 commands + emit theme:changed
│   ├── pty.rs           # 10 commands
│   ├── git.rs           # 26 commands
│   ├── tabs.rs          # 5 commands
│   ├── diagnostics.rs   # 5 commands
│   ├── ai_config.rs     # 32 commands
│   ├── fs_ops.rs        # 10 commands + watcher
│   ├── integrations.rs  # 12 commands
│   ├── files.rs         # 2 commands (saveTempImage, pathExists)
│   ├── ai.rs            # 2 commands (generateDescription, checkAvailability)
│   ├── app.rs           # 3 commands (version, window close, dialog)
│   └── screenshot.rs    # 1 command
├── pty/
│   ├── mod.rs
│   ├── manager.rs       # PtyManager: HashMap<String, PtySession>
│   ├── session.rs       # state machine, buffer, activity detection
│   ├── ring_buffer.rs   # 5MB circular buffer with seq tracking
│   ├── parsers.rs       # prompt detection, conversation ID, ANSI filtering
│   └── adapters/
│       ├── mod.rs
│       ├── claude.rs     # claude-code adapter
│       ├── codex.rs      # codex adapter
│       ├── cursor.rs     # cursor-agent adapter
│       ├── gemini.rs     # gemini adapter
│       ├── opencode.rs   # opencode adapter
│       └── terminal.rs   # plain shell adapter
├── integrations/
│   ├── mod.rs
│   ├── linear_client.rs # GraphQL via reqwest
│   ├── credentials.rs   # keyring crate
│   ├── sync.rs          # pull/push/conflict resolution
│   └── markdown.rs      # comrak HTML↔markdown
├── diagnostics/
│   ├── mod.rs
│   ├── service.rs       # event recording, redaction, retention
│   └── instrumentation.rs # command wrapper for auto-logging
└── mcp/
    ├── mod.rs
    └── server.rs         # axum HTTP+SSE, update_task tool
```

### State Management
```rust
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

pub struct AppState {
    pub db: Mutex<rusqlite::Connection>,
    pub pty_manager: Mutex<PtyManager>,
    pub watchers: Mutex<HashMap<PathBuf, notify::RecommendedWatcher>>,
    pub diagnostics: Mutex<DiagnosticsService>,
    pub sync_handle: Mutex<Option<tokio::task::JoinHandle<()>>>,
}
```

### Error Pattern
```rust
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("DB: {0}")] Db(#[from] rusqlite::Error),
    #[error("IO: {0}")] Io(#[from] std::io::Error),
    #[error("Git: {0}")] Git(#[from] git2::Error),
    #[error("HTTP: {0}")] Http(#[from] reqwest::Error),
    #[error("JSON: {0}")] Json(#[from] serde_json::Error),
    #[error("Keyring: {0}")] Keyring(#[from] keyring::Error),
    #[error("{0}")] Custom(String),
}

impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where S: serde::Serializer {
        serializer.serialize_str(&self.to_string())
    }
}
```

### Command Pattern
```rust
#[tauri::command]
async fn get_projects(state: tauri::State<'_, AppState>) -> Result<Vec<Project>, AppError> {
    let db = state.db.lock().unwrap();
    let mut stmt = db.prepare("SELECT id, name, color, ... FROM projects ORDER BY created_at")?;
    let projects = stmt.query_map([], |row| { ... })?.collect::<Result<Vec<_>, _>>()?;
    Ok(projects)
}
```

---

## PTY System (Critical Path)

### Terminal Modes
```rust
enum TerminalMode {
    ClaudeCode,   // "claude-code"
    Codex,        // "codex"
    CursorAgent,  // "cursor-agent"
    Gemini,       // "gemini"
    Opencode,     // "opencode"
    Terminal,     // "terminal"
}
```

### State Machine
```
starting → running (on first output)
running → attention (idle timeout 60s, or adapter signal)
attention → running (on spinner detected, or user input for transitionOnInput adapters)
running → error (adapter detects error in output)
error → running (on valid activity)
* → dead (on process exit)
```
- State transitions debounced 100ms (except attention→running which is immediate)

### Ring Buffer
- 5MB max capacity, circular
- Each `append(data)` returns incrementing `seq` number
- `getChunksSince(afterSeq)` returns delta for reconnection
- `clear()` resets buffer but preserves `seq` counter

### ANSI Filtering (regex must be ported exactly)
```
OSC strip:    \x1b\](?:[012]|52)[;][^\x07\x1b]*(?:\x07|\x1b\\)
DA filter:    \x1b\[\?[0-9;]*c
SGR underline: \x1b\[([0-9;:]*)m  (filter code '4' + subparams like '4:3')
```

### Adapter Trait
```rust
trait TerminalAdapter {
    fn build_spawn_config(&self, session_id: &str, cwd: &str, ...) -> SpawnConfig;
    fn detect_activity(&self, data: &str, current: ActivityState) -> ActivityState;
    fn detect_error(&self, data: &str) -> Option<ErrorInfo>;
    fn detect_prompt(&self, data: &str) -> Option<PromptInfo>;
}
```

### PTY Data Flow
1. `portable-pty::MasterPty::read()` on dedicated OS thread
2. Filter ANSI escapes
3. Append to ring buffer (get `seq`)
4. `AppHandle::emit("pty:data", PtyDataPayload { session_id, data, seq })`
5. Detect activity/errors/prompts via adapter
6. Emit state changes if transition detected

### Session ID Format
`{taskId}:{mode}` — e.g., `abc123:claude-code`

### Environment Injection
```rust
env.insert("SLAYZONE_TASK_ID", task_id);
env.insert("SLAYZONE_MCP_PORT", mcp_port);
env.insert("TERM", "xterm-256color");
env.insert("COLORTERM", "truecolor");
env.insert("COLORFGBG", if dark { "15;0" } else { "0;15" });
```

### Gotchas
- Delete session from map BEFORE `pty.kill()` (onData handlers check existence)
- Use SIGKILL (signal 9), not SIGTERM
- Normalize `0.0.0.0` → `localhost` for dev server URL dedup
- Clear debounce timers on kill
- 5s timeout for conversation ID detection after `/status`

---

## Linear Integration

### GraphQL Client
Endpoint: `https://api.linear.app/graphql`
Auth: `Authorization: <apiKey>` header

**Queries:**
- `getViewer()` → workspace ID/name, user email
- `listTeams(apiKey)` → `[{id, key, name}]`
- `listProjects(apiKey, teamId)` → `[{id, name, teamId}]`
- `listWorkflowStates(apiKey, teamId)` → `[{id, name, type}]` (type: backlog|started|completed|canceled|unstarted|triage)
- `listIssues(apiKey, {teamId|projectId, first, after})` → paginated with cursor
- `getIssue(apiKey, issueId)` → full issue
- `updateIssue(apiKey, issueId, {title, description, priority, stateId})` → mutation

### Priority Mapping
| Linear | Local |
|--------|-------|
| 0 (none) | 3 |
| 1 (urgent) | 5 |
| 2 (high) | 4 |
| 3 (medium) | 3 |
| 4 (low) | 2 |
| 5 (lowest) | 1 |

### Status Mapping
| Linear State Type | Local Status |
|-------------------|--------------|
| backlog | backlog |
| started | in_progress |
| completed | done |
| canceled | done |
| unstarted | todo |
| triage | todo |

### Sync Algorithm
1. Query `external_links` joined with `integration_connections` and `tasks`
2. For each link: fetch remote issue, compare `updatedAt` timestamps
3. If remote newer → PULL (update local task, markdown→HTML conversion)
4. If local newer + `two_way` mode → PUSH (update remote issue, HTML→markdown conversion)
5. Track field state in `external_field_state` table for conflict detection
6. Update `last_synced_at` on connection
7. Background poller: runs every 5 minutes

### Credentials
- Current: Electron `safeStorage.encryptString()` / `decryptString()` stored in SQLite
- Tauri: `keyring` crate → OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service)
- Migration: on first Tauri launch, detect encrypted credentials and prompt re-entry

---

## Diagnostics System

### Storage
```sql
CREATE TABLE diagnostics_events (
    id TEXT PRIMARY KEY,
    ts_ms INTEGER NOT NULL,
    level TEXT,           -- debug|info|warn|error
    source TEXT,          -- ipc|db|renderer|main|settings
    event TEXT,           -- e.g. 'ipc.request', 'db.mutation'
    trace_id TEXT,        -- ties request/response/error
    task_id TEXT,
    project_id TEXT,
    session_id TEXT,
    channel TEXT,          -- e.g. 'db:tasks:create'
    message TEXT,
    payload_json TEXT,     -- redacted
    redaction_version INTEGER
);
```

### Redaction
Strip before storing: Bearer tokens, API keys, passwords, secrets, PEM keys

### Retention
- Sweep every 6 hours
- Delete events older than `diagnostics_retention_days` (default 14)
- Hard cap: 200k events

### IPC Instrumentation
Wrap all `#[tauri::command]` handlers to auto-log:
- `ipc.request` (channel, args hash)
- `ipc.response` (channel, duration_ms)
- `ipc.error` (channel, error message)

---

## MCP Server

### Architecture
- `axum` HTTP server on `127.0.0.1:PORT` (default 45678)
- Session-based: `mcp-session-id` header, UUID per session
- Session idle timeout: 30 min, check interval: 5 min
- Single tool: `update_task`

### `update_task` Tool
Parameters: title, description, status (1-5), priority, assignee, due_date, close (bool)
- Reads `SLAYZONE_TASK_ID` env var
- Updates task in DB
- Emits `tasks:changed` to renderer
- If `close=true`, emits `app:close-task`

---

## Frontend Abstraction Layer

### Runtime Detection
```typescript
// packages/shared/types/src/api-client.ts
const isTauri = '__TAURI_INTERNALS__' in window

export const api: ElectronAPI = isTauri ? tauriApi : window.api
```

### TauriApiClient
```typescript
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

export const tauriApi: ElectronAPI = {
  db: {
    getProjects: () => invoke('get_projects'),
    createProject: (data) => invoke('create_project', { data }),
    updateProject: (data) => invoke('update_project', { data }),
    deleteProject: (id) => invoke('delete_project', { id }),
    getTasks: () => invoke('get_tasks'),
    // ... 1:1 for all methods
  },
  pty: {
    onData: (cb) => {
      const p = listen('pty:data', (e) => {
        const { sessionId, data, seq } = e.payload as any
        cb(sessionId, data, seq)
      })
      return () => { p.then(fn => fn()) }
    },
    // ... all event subscriptions return unlisten fns
  },
  // ... all 21 namespaces
}
```

### Key Difference: Event Subscriptions
- Electron: `ipcRenderer.on(channel, handler)` → returns manual `removeListener` fn
- Tauri: `listen(event, handler)` → returns `Promise<UnlistenFn>`
- Wrapper must handle the async unlisten: `return () => { promise.then(fn => fn()) }`

---

## Phases

### Phase 0: Frontend Abstraction
Create `TauriApiClient` + runtime detection. No backend changes.
- Create `packages/shared/types/src/tauri-api.ts` (stub — all methods throw "not implemented")
- Create `packages/shared/types/src/api-client.ts` (runtime detection)
- Update `App.tsx` to use `api-client` instead of `window.api`
- **Verify**: `pnpm dev` still works, all E2E pass unchanged

### Phase 1: Tauri Scaffold + DB + CRUD
`cargo tauri init`, port 34 migrations, implement all pure-DB commands.
- **Commands**: 53 (projects 4, tasks 17, tags 6, settings 3, theme 3, diagnostics 5, tabs 5, app 3, files 2, screenshot 1, claude 1, shell 1, ai 1)
- **Key work**: translate all 34 SQL migrations to Rust strings, implement row→struct mapping
- **Verify**: `cargo tauri dev`, create project + task via UI, verify SQLite file

### Phase 2: Git Operations
Port 26 git commands using `git2` crate + `std::process::Command` fallback for worktree ops.
- **Commands**: 26
- `git2` for: isGitRepo, getCurrentBranch, listBranches, hasUncommittedChanges, stageFile, unstageFile, getWorkingDiff, commitFiles
- `std::process::Command` for: createWorktree, removeWorktree, mergeIntoParent, abortMerge (git2 worktree/merge API limited)
- **Verify**: create worktree, merge, stage/unstage, diff, commit

### Phase 3: File System
Port fs namespace + file watcher using `notify` crate.
- **Commands**: 10 + `fs:changed` event
- `walkdir` for `listAllFiles`, `notify::RecommendedWatcher` for watch/unwatch
- **Verify**: browse file tree, edit file, watch detects changes

### Phase 4: AI Config
Port 32 aiConfig commands. Mostly DB + filesystem ops.
- **Commands**: 32
- Key: context file discovery, MCP config parsing, provider registry, SKILL.md sync
- **Verify**: CRUD context items, toggle providers, sync to disk

### Phase 5: Integrations
Port Linear client, credentials, sync engine.
- **Commands**: 12
- `reqwest` for GraphQL, `keyring` for credentials, `comrak` for markdown↔HTML
- **Verify**: connect Linear workspace, import issues, sync pull/push

### Phase 6: Terminal / PTY (Critical Path)
Port entire PTY system with `portable-pty`.
- **Commands**: 10 + 8 event channels
- Dedicated OS thread per PTY session reading from `MasterPty`
- Port ring buffer (5MB circular), ANSI filters, state machine, 6 adapter implementations
- Port prompt detection regex, conversation ID extraction, dev server URL detection
- **Risk**: HIGHEST — prompt regex fidelity, buffer seq ordering, state transition timing
- **Verify**: spawn shell, spawn claude-code, prompt detection works, buffer replay on reconnect, kill cleanup

### Phase 7: App Lifecycle + Window
Splash screen, menu bar, keyboard shortcuts, webview replacement.
- Tauri window config in `tauri.conf.json`
- Custom menu via `tauri::menu::Menu`
- Keyboard shortcuts: Cmd+§ (go home), Cmd+, (settings), Cmd+Shift+, (project settings), Cmd+Shift+S (screenshot)
- Splash: custom Tauri window with data URL, timed transition
- **Verify**: splash → main, shortcuts fire events, dock icon

### Phase 8: MCP Server
Port HTTP+SSE server using `axum`.
- `axum::Router` with POST/GET/DELETE `/mcp`
- Session management with `HashMap<String, Transport>`
- `update_task` tool handler
- **Verify**: MCP protocol handshake, task update via curl

---

## Contract Test Strategy

116 existing TypeScript handler tests document exact I/O contracts. For each Rust command:
1. Port as `#[test]` or `#[tokio::test]` with in-memory `rusqlite::Connection::open_in_memory()`
2. Run same 34 migrations on in-memory DB
3. Assert identical return shapes (field names, types, edge cases)
4. Translate test fixtures (seeds, mock data) to Rust structs

Test files: `src-tauri/tests/` mirroring `packages/shared/test-utils/` structure.

---

## DB Tables (from 34 migrations)

| Table | Key Columns |
|-------|-------------|
| `projects` | id, name, color, path, auto_create_worktree, created_at, updated_at |
| `tasks` | id, project_id, parent_id, title, description, status, priority, due_date, assignee, provider_config (JSON), web_panel_urls (JSON), sort_order, archived_at |
| `tags` | id, name, color |
| `task_tags` | task_id, tag_id |
| `task_dependencies` | task_id, depends_on_task_id |
| `settings` | key, value |
| `terminal_tabs` | id, task_id, label, mode, is_main, sort_order |
| `ai_config_sources` | id, type, content, provider, content_hash, ... |
| `ai_config_project_selections` | project_id, item_id, provider, content_hash, enabled |
| `integration_connections` | id, provider, workspace_id, workspace_name, credential_ref, sync_mode, last_synced_at |
| `integration_project_mappings` | id, project_id, connection_id, external_team_id, external_project_id |
| `integration_state_mappings` | id, mapping_id, local_status, external_state_id, external_state_name |
| `external_links` | id, task_id, provider, connection_id, external_id, sync_state, last_synced_at |
| `external_field_state` | id, link_id, field_name, last_local_value, last_external_value, ... |
| `diagnostics_events` | id, ts_ms, level, source, event, trace_id, channel, message, payload_json |

---

## Unresolved Questions

- `git2` vs `std::process::Command` for git ops? git2 faster but limited worktree/merge support — hybrid likely needed
- `portable-pty` Windows support — test early or defer?
- Webview tag replacement? Tauri 2.x has no `<webview>` — iframe with permissions? separate window?
- MCP server: keep as separate axum process or Tauri plugin?
- Theme: Tauri doesn't expose `nativeTheme` — `window-vibrancy` crate or CSS-only dark mode?
- Linear sync poller: `tokio::spawn` + `AppHandle` clone?
- Screenshot capture: Tauri has no `desktopCapturer` — `xcap` crate?
- Credential migration: auto-detect Electron-encrypted credentials on first Tauri launch?
- `comrak` vs `pulldown-cmark` for markdown — comrak has HTML output but pulldown is faster
