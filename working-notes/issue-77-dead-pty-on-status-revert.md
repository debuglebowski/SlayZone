# Issue #77 — Dead Claude Code session after `done → in_progress`

## Problem

`done` → `killPty` runs. `killPty` deletes session map entry **before** SIGKILL → node-pty `onExit` early-returns → `finalizeSessionExit` never fires → `pty:exit` IPC + `transitionState('dead')` never reach renderer. Client xterm stays mounted, `ptyState` stale, dead overlay gated off. Moving back to `in_progress` triggers no respawn (init effect mount-only, tab uses `display:none`). User types, `writePty` returns false silently. Perceived as dead session.

## Goal

1. Kill path must notify renderer reliably.
2. Reviving a task (`terminal → non-terminal`) auto-respawns the PTY, resuming the AI conversation when reasonable.

## Plan — Part A: unified kill IPC

**Scope**: `packages/domains/terminal/src/main/pty-manager.ts`

**Change**: route `killPty` through `finalizeSessionExit(exitCode)` so every kill path emits `pty:exit` + `pty:state-change → dead` the same way a natural exit does.

**Approach**:
- Add exit-code constant: `PTY_EXIT_KILLED_BY_HOST = -2` (distinct from unknown `-1`).
- In `killPty`:
  - Keep diagnostics + timer/notification cleanup.
  - Call `session.pty.kill('SIGKILL')` **without** eagerly doing `sessions.delete` / `dataListeners.delete`.
  - Let node-pty's `onExit` (line 1112) land → the existing guard now passes → `finalizeSessionExit(exitCode)` runs → IPC goes out, 100 ms trailing cleanup deletes the maps.
- Fallback path: if `session.pty.kill` throws (already dead on Windows path), call `finalizeSessionExit(PTY_EXIT_KILLED_BY_HOST)` explicitly so we're not stuck.
- `finalized` flag (line 753) already makes `finalizeSessionExit` idempotent — double-invocation safe.

**Touches**:
- `pty-manager.ts:1379-1422` (`killPty`) — reorder + delegate.
- `pty-manager.ts:1490-1493` (`killAllPtys`) — no change (delegates to `killPty`).
- `pty-manager.ts:1496-1503` (`killPtysByTaskId`) — no change.

**Verification**:
- Unit: extend `state-machine.test.ts` / new `pty-manager.kill.test.ts` asserting `pty:exit` fires and state → `dead` on `killPty`.
- Integration (renderer): `PtyContext.exit.test.ts` extended — confirm `applyExitEvent` ran after kill.
- Diagnostics: `pty.kill` event AND `pty.exit` event both present in `slayzone.dev.diagnostics.sqlite` for every kill.

## Plan — Part B: auto-respawn on revive

**Scope**: `packages/domains/task/src/main/handlers.ts`, `packages/domains/terminal/src/main/pty-manager.ts` (new IPC), `packages/domains/terminal/src/client/PtyContext.tsx` or `Terminal.tsx`.

**Trigger**: in `updateTask`, after write, detect:
```
previousStatus reachedTerminal && newStatus !reachedTerminal
```
(status-category transition, not literal string compare — use existing `isTerminalStatus`).

**Signal model**: new IPC `pty:respawn-suggested` broadcast carrying `{ taskId, reason: 'status-revived' }`. Renderer listens, decides per-tab whether to spawn.

**Renderer decision** (per terminal-tab):
1. Is this tab's session alive? (`window.api.pty.exists`) → if yes, ignore (idempotent).
2. Was this tab ever alive in this session (i.e. had a PTY that was killed)? Track via a `wasAlive` bit on the renderer tab state, set on first `pty:exit` observed for that session.
3. If `wasAlive && !exists` → call the existing create path (same branch in `Terminal.tsx:558-590`), BUT reuse `existingConversationId` from `provider_config.{mode}.conversationId`.

**Cold-session rule**:
- Record `last_pty_killed_at` timestamp in `provider_config.{mode}` (new field) at finalize time when exit code = `PTY_EXIT_KILLED_BY_HOST`.
- On respawn: if `now - last_pty_killed_at > COLD_THRESHOLD` (default 30 min), clear `conversationId` before spawn → fresh conversation.
- Threshold = setting `pty_cold_respawn_threshold_min` default 30, settable later.

**Plain-terminal guard**: skip auto-respawn for `mode === 'terminal'`. Plain shells have no conversation model, user more likely wants a fresh shell; let them reopen manually. (Revisit if users complain.)

**Secondary-tab guard**: only auto-respawn the **main** tab. Non-main tabs carry per-task-session intent — auto-spawning them on status revive is surprising. `useTaskTerminals.ts:137` already auto-closes non-main on exit — they're gone by the time revive fires.

**Debounce**: if `now - last_pty_killed_at < 2 s`, treat as status flicker and still respawn (user probably dragged past `done`). Cold rule only fires in the other direction, so no conflict.

**Touches**:
- `handlers.ts:506-509` — add post-write transition detection, emit `pty:respawn-suggested`.
- `pty-manager.ts` — persist `last_pty_killed_at` in `provider_config` via existing helper.
- New renderer subscriber — ~50 LOC in `Terminal.tsx` or new hook `usePtyRespawnListener`.
- Unit: `task/src/main/handlers.test.ts` — `status done → in_progress emits pty:respawn-suggested`.
- Unit: renderer listener respects `exists`, `wasAlive`, cold threshold.
- E2E: `59-pty-revive.spec.ts` new — drag done → in_progress → type → observe typed chars land.

## Part C (followup, separate task) — not in this plan

Bound `terminal-cache` (task `754280c8`). Unrelated to #77, don't conflate.

## Risk

| Area | Risk | Mitigation |
|---|---|---|
| `useTaskTerminals.ts:137` auto-closes non-main on exit | After A, `killPtysByTaskId` on done now closes secondary tabs | Intended (they're dead anyway). Document in PR. |
| Double IPC for natural exit | Unlikely — `finalized` flag prevents | Covered by existing idempotency |
| Respawn loop if respawn itself fails fast | Retry storm | Respawn path already has `canAsyncFallback` + watchdog (line 1120). One-shot trigger per status transition — no loop possible. |
| User moved done → in_progress as way to "restart session fresh" | Auto-respawn resumes old convo | Cold threshold covers long gaps. Short gaps intentional revive. Make threshold settable. |
| E2E tests relying on done → kill-then-nothing | Now spawn happens | Scan `packages/apps/app/e2e/` for status-done tests. |

## Rollout

1. Land Part A. Ship. Observe diagnostics — `pty.exit` now fires for every kill. Low risk.
2. Land Part B behind setting `auto_respawn_on_revive` default `true`. If regressions, flip default.
3. After 1 release cycle clean, drop the setting (make unconditional).

## Test matrix

- Terminal mode: claude-code, codex, gemini, cursor-agent, opencode, plain `terminal`.
- Flow: done→in_progress (hot), done→[30 min wait]→in_progress (cold), done→delete (no respawn), create→in_progress (no respawn, never alive), main tab only vs main+secondary.
- Edge: rapid status flicker (done/in_progress/done/in_progress) → one final respawn, not N.

## Unresolved questions

- Cold threshold: 30 min default good? Or settable-only, no default kill-switch?
- Plain `terminal` mode: auto-respawn or leave manual? Current plan: manual.
- `pty:respawn-suggested` vs main respawning PTYs directly: IPC version keeps separation of concerns. OK?
- Non-main tabs: leave dead (current plan) or remember config and re-create with same mode/label?
- Should revive clear `crashOutput` / `deadExitCode` client state if shown briefly before respawn completes?
- Store `last_pty_killed_at` in `provider_config` or separate column? (Current plan: provider_config to stay inside v34 model.)
- Naming: `PTY_EXIT_KILLED_BY_HOST` vs `PTY_EXIT_PROGRAMMATIC` vs `PTY_EXIT_TASK_DONE`? Prefer generic (host).
