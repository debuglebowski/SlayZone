# Research Project Workflow

## DEPRECATED

**This workflow has been consolidated into the gsd-researcher agent.**

The research methodology for project research now lives in:
- `agents/gsd-researcher.md`

The `/gsd:research-project` command spawns 4 parallel gsd-researcher agents:
- Stack agent -> .planning/research/STACK.md
- Features agent -> .planning/research/FEATURES.md
- Architecture agent -> .planning/research/ARCHITECTURE.md
- Pitfalls agent -> .planning/research/PITFALLS.md

The orchestrator synthesizes SUMMARY.md after all agents complete.

**Migration:** No action needed - the command handles this automatically.

---

*Deprecated: 2026-01-15*
*Replaced by: agents/gsd-researcher.md*
