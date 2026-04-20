# Claude Code stream-json — Spike Findings

Captured 2026-04-18. Claude CLI version 2.1.114.

## Spike A — Bidirectional multi-turn: PASS

Command:
```
claude -p \
  --input-format stream-json --output-format stream-json --verbose \
  --allow-dangerously-skip-permissions \
  --session-id <uuid>
```

- Child stays alive between user messages.
- Second user message → second `result:success` event received cleanly.
- Clean exit code 0 on `stdin.end()`.

**Decision**: transport = single long-lived `child_process.spawn` per tab. One process handles N turns via NDJSON stdin.

## Spike B — Event schema (ground truth)

9 fixtures captured in this directory — one per tool.

### Event types observed

| `type`              | When                                   | In plan? |
|---------------------|----------------------------------------|----------|
| `system` subtype `init` | **per turn** (not just session start) | partial — plan said session-start, reality is turn-init |
| `system` subtype `task_started` | sub-agent tool begins        | **NEW** |
| `system` subtype `task_updated` | sub-agent progress           | **NEW** |
| `system` subtype `task_notification` | sub-agent notifications   | **NEW** |
| `rate_limit_event`  | rate-limit status pings                | **NEW** |
| `assistant`         | one content block per event (thinking / tool_use / text) | partial |
| `user`              | tool_result (NOT user prompt)          | partial |
| `result` subtype `success` / error variants | end of turn    | yes |

Lenient parser + `{kind:'unknown', raw}` covers the unplanned types gracefully.

### Assistant events are block-scoped, not message-scoped

Each `assistant` event carries **one** `content[]` block. Same `message.id` appears across multiple events (thinking → tool_use → text). Reducer must accumulate blocks per message id, not dedupe by it.

### Thinking blocks

```json
{"type":"thinking","thinking":"","signature":"<base64>"}
```

`thinking` field often empty (encrypted). Signature present. UI: show "Thinking..." placeholder when text empty.

### Tool-use shape

Inside assistant `content[]`:
```json
{"type":"tool_use","id":"toolu_...","name":"Read","input":{...},"caller":{"type":"direct"}}
```

Drop `caller` (irrelevant).

### Tool-result shape (the good stuff)

Arrives as `user` event:
```json
{
  "type":"user",
  "message":{"role":"user","content":[{
    "tool_use_id":"toolu_...",
    "type":"tool_result",
    "content":"...string or ContentBlock[]..."
  }]},
  "tool_use_result": { /* structured, tool-specific */ }
}
```

**`tool_use_result` is pre-parsed per tool — use directly in renderers:**

- **Edit** → `{filePath, oldString, newString, structuredPatch:[{oldStart,oldLines,newStart,newLines,lines[]}], userModified, replaceAll}`  
  `structuredPatch` is unified-diff-ready → pipe to existing `DiffView` (or use directly).
- **Read** → `{type:'text', file:{filePath, content, numLines, startLine, totalLines}}`
- **Grep** (files mode) → `{mode:'files_with_matches', filenames:[...], numFiles}`
- **Grep** (content mode) → `{mode:'content', content:'file:line:match...', numLines}`
- **TodoWrite** → `{oldTodos:[{content,status,activeForm}], newTodos:[...], verificationNudgeNeeded}`
- **ToolSearch** → `{matches:[...], query, total_deferred_tools}`
- **Bash** → inspect fixture later (current fixture returned via plain content string)

### Result event — richer than planned

```
subtype, is_error, api_error_status, duration_ms, duration_api_ms,
num_turns, total_cost_usd, stop_reason, terminal_reason,
usage { input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens, server_tool_use, iterations[] },
modelUsage { [modelId]: { inputTokens, outputTokens, costUSD, ... } },
permission_denials[], fast_mode_state
```

Rich footer opportunity. v1 render: duration, cost, token totals. Expandable to show per-model + permission denials.

## Spike C — Interrupt semantics

### SIGINT: UNRELIABLE

- SIGINT at +4s into a long-running Bash tool: Claude **ignored it**, continued full tool execution, emitted `result:success` at +30s, then spontaneously started a NEW turn (second `system:init` + more tool calls).
- Possibly interpreted SIGINT as "start another turn".
- Conclusion: **do not use SIGINT for interrupt**.

### Decision

- **Interrupt = SIGTERM + respawn with `--resume <sessionId>`**. Clean, deterministic. User loses in-flight result, keeps conversation history via resume.
- **Kill = SIGTERM → 2s grace → SIGKILL**. Standard.

## Updates to plan

1. Expand `AgentEvent` union:
   - `rate-limit` (new)
   - `task-started`, `task-updated`, `task-notification` (sub-agent events — new)
   - `session-start` → rename to `turn-init`; flag `isFirst: boolean` in state to distinguish real session start
2. `assistant-*` events: reducer accumulates per `message.id`, one event = one content block.
3. `ToolResultEvent` carries both `rawContent: string|ContentBlock[]` AND `structured: unknown` (tool-specific). `ToolCallEdit` reads `structured.structuredPatch` directly (skip synthesizing FileDiff).
4. `ChatTransportManager.interrupt()` = `SIGTERM` → respawn with `--resume`, NOT SIGINT.
5. `ThinkingBlock` renderer: empty `thinking` text → "Thinking..." placeholder.
6. `Result` renderer surface: duration, cost, token totals, collapsible `modelUsage`.

Fixtures available:
- read.ndjson, edit.ndjson, write.ndjson, bash.ndjson
- glob.ndjson, grep.ndjson, todowrite.ndjson
- thinking.ndjson, multi-tool.ndjson
