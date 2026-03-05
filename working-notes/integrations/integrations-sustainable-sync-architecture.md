# Integrations: Sustainable Sync Architecture

## Why this document exists
We have a working project-specific Linear/GitHub integration UX, manual pull/push controls, and visible sync status in task metadata. However, the current implementation is still interaction-driven (UI handlers call sync operations directly) and partially polling-based. This doc proposes the robust architecture required for long-term maintainability and safe auto-sync-on-change.

## Current state (as of 2026-03-05)
- Project-specific integrations are in place for Linear and GitHub.
- Continuous sync exists in settings and one-off import flows exist.
- Manual pull/push exists in task metadata and project settings.
- Task-level sync status is visible (`in_sync`, `local_ahead`, `remote_ahead`, `conflict`, `unknown`).
- Linear has a periodic poller; GitHub sync is largely manual.

## Main problems with current architecture
- Sync behavior is spread across UI components and provider handlers.
- No durable outbox for local changes that must be pushed.
- No unified background worker abstraction across providers.
- Retry/backoff/offline recovery is limited and inconsistent.
- Risk of drift between UI state and actual sync state under failures.
- Hard to add immediate push-on-change safely without loops/rate-limit issues.

## Target outcome
A provider-agnostic sync engine where:
- Local edits enqueue sync intents in a durable DB outbox.
- A single background worker processes intents with retries and backoff.
- Provider adapters (Linear/GitHub) are stateless execution units.
- UI reads sync state from DB and sends intents only (no provider logic in UI).
- Push-on-change can be enabled safely with debounce and loop prevention.

## Design principles
- One source of truth: DB state, not component state.
- Idempotent jobs: safe to retry without duplicating effects.
- Explicit state machine: predictable transitions.
- Separation of concerns:
  - UI = intent + presentation
  - Engine = scheduling + policy
  - Adapter = provider API mapping
- Incremental rollout with feature flags.

## Proposed architecture

### 1) Durable outbox
Create `sync_jobs` table:
- `id`
- `task_id`
- `project_id`
- `provider`
- `job_type` (`push`, `pull`, `reconcile`, `refresh_status`)
- `dedupe_key` (task + provider + job_type + fingerprint)
- `payload_json`
- `priority`
- `state` (`pending`, `running`, `succeeded`, `failed`, `dead_letter`)
- `attempt_count`
- `next_attempt_at`
- `last_error`
- `created_at`, `updated_at`

Rules:
- Unique/dedupe on active `dedupe_key`.
- Keep short retention history for observability.

### 2) Sync engine worker
Single worker loop per app process:
- Claims jobs atomically (`pending` + `next_attempt_at <= now`).
- Moves to `running` with lock token.
- Executes adapter action.
- Updates status/baseline/link state.
- Marks success/failure.
- On failure, schedules retry with exponential backoff + jitter.
- Sends failed jobs to `dead_letter` after max attempts.

### 3) Provider adapters
`LinearAdapter` and `GitHubAdapter` with same interface:
- `pushTask(taskId, context)`
- `pullTask(taskId, context)`
- `computeStatus(taskId, context)`
- `import(...)`

Adapters should not schedule jobs; they only execute operations.

### 4) Sync state model
Create/extend task sync state persisted in DB:
- `sync_health` (`unknown`, `in_sync`, `local_ahead`, `remote_ahead`, `conflict`, `error`)
- `last_synced_at`
- `last_error`
- `pending_jobs_count`
- per-field diff summary (optional compact JSON)

UI uses these fields for pills/badges/spinners.

### 5) Change capture pipeline
On task write events (title/description/status/priority):
- Compute provider links for the task.
- If integration enabled and link exists, enqueue `push` intent.
- Debounce/coalesce by `dedupe_key` (for rapid edits).
- Do not call provider APIs from UI write path.

### 6) Loop/conflict prevention
- Persist baseline snapshots per field (already partly present via `external_field_state`).
- On pull/apply, annotate origin metadata so resulting local write does not enqueue echo push.
- Conflict policy defaults:
  - one-way: remote authoritative
  - two-way: baseline comparison -> `local_ahead`/`remote_ahead`/`conflict`

### 7) Observability
- Structured sync logs: provider, task, operation, duration, result.
- Counters: jobs queued, succeeded, retried, dead-lettered.
- Optional diagnostics export for failed sync traces.

## UX behavior with this architecture
- User edits task -> status becomes `Pending sync` immediately.
- Worker runs soon after debounce window.
- Status changes to `Syncing` then `In sync` or `Failed`.
- Pull/push buttons enqueue high-priority jobs and reflect progress from DB.
- Project settings can show queue health and last successful run.

## Migration plan (phased)

### Phase 1: Engine foundation
- Add `sync_jobs` table and worker skeleton.
- Add enqueue API and dedupe/backoff.
- Keep existing manual actions but route through job enqueue.

### Phase 2: Provider unification
- Move Linear/GitHub push/pull execution into adapters.
- Keep old handlers as thin wrappers around engine.

### Phase 3: Automatic push-on-change
- Hook task updates to enqueue push intents with debounce.
- Add origin tags to avoid pull->push echo.

### Phase 4: UI state source cleanup
- UI reads DB sync state only.
- Remove ad hoc component-level diff logic where duplicated.

### Phase 5: Hardening
- Dead-letter tooling.
- Metrics and diagnostics.
- E2E coverage for offline/retry/conflict scenarios.

## Testing strategy
- Unit tests:
  - job state transitions
  - dedupe behavior
  - retry scheduling
  - conflict classification
- Integration tests:
  - worker + sqlite + mocked adapters
  - pull/push job idempotency
- E2E tests:
  - edit task -> pending -> synced
  - network failure -> retries -> recovery
  - conflict path with explicit user-visible status

## Acceptance criteria for “robust auto-sync-on-change”
- No direct provider API calls from UI event handlers.
- 100% of pushes/pulls flow through durable outbox.
- Retries/backoff verified by tests.
- No update echo loop after pull apply.
- Clear UI for pending/syncing/failed/conflict.
- Can restart app mid-sync without losing pending work.

## Scope and timeline estimate
- Robust Linear + GitHub architecture + worker + queue + UI state integration: ~6-10 working days.
- With full hardening and comprehensive tests: ~10-14 working days.

## Recommended immediate next steps
1. Create DB migration for `sync_jobs`.
2. Implement worker claim/run/complete/fail loop.
3. Refactor existing pull/push handlers to enqueue jobs.
4. Add task-write enqueue hook with debounce + dedupe.
5. Add visible `pending/syncing/failed` indicators sourced from DB.
