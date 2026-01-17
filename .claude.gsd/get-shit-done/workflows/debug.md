# Debug Workflow (DEPRECATED)

This workflow has been consolidated into the `gsd-debugger` agent.

**Location:** `agents/gsd-debugger.md`

**Reason:** The gsd-debugger agent contains all debugging expertise. Loading a separate workflow into orchestrator context was wasteful.

**Migration:**
- `/gsd:debug` now spawns `gsd-debugger` agent directly
- All debugging methodology lives in the agent file
- Templates remain at `get-shit-done/templates/DEBUG.md`

See `agents/gsd-debugger.md` for debugging expertise.
