---
phase: 05-ai-integration
plan: 01
subsystem: ai
tags: [claude-cli, streaming, types, migration]
dependency-graph:
  requires: [04-task-management]
  provides: [claude-streaming-types, chat-persistence, spawner-service]
  affects: [05-02, 05-03]
tech-stack:
  added: []
  patterns: [ndjson-streaming, process-spawning]
key-files:
  created:
    - src/main/services/claude-spawner.ts
  modified:
    - src/shared/types/api.ts
    - src/shared/types/database.ts
    - src/main/db/migrations.ts
decisions:
  - key: ndjson-readline
    choice: "readline.createInterface for NDJSON parsing"
    rationale: "Handles partial chunks correctly"
  - key: single-process
    choice: "One active Claude process at a time"
    rationale: "Simpler cancel logic, prevents resource exhaustion"
metrics:
  duration: 2min
  completed: 2026-01-17
---

# Phase 5 Plan 1: Claude CLI Foundation Summary

**One-liner:** Types, migration, and spawner service for Claude CLI streaming integration

## What Was Built

### Claude Streaming Types (api.ts)
- `ClaudeStreamEvent`: Typed events matching stream-json output (system/assistant/result)
- `ChatMessage`: Message persistence type (workspace_item_id, role, content)
- `CreateChatMessageInput`: Input type for chat API

### Database Migration (v3)
- `chat_messages` table with FK to workspace_items
- Role CHECK constraint (user/assistant)
- Index on workspace_item_id for query performance

### Claude Spawner Service
- `streamClaude(win, prompt, context)`: Spawns Claude CLI, streams NDJSON to renderer
- `cancelClaude()`: Terminates active process
- `getActiveProcess()`: Process tracking for status checks

## Key Implementation Details

**Stream Format:** Uses `--output-format stream-json` for NDJSON output
**IPC Events:** `claude:chunk`, `claude:error`, `claude:done`
**Process Management:** Single active process tracked, killed before new spawn

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 633dbc0 | feat | Claude streaming and ChatMessage types |
| 70be9cd | feat | chat_messages table migration (v3) |
| 7568fc2 | feat | claude-spawner service |

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

**Ready for 05-02:** IPC handlers and chat API
- Types exported and ready for use
- Spawner service can be imported in main/index.ts
- Migration adds persistence layer for chat messages

**Blockers:** None
