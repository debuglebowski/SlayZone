# DEPRECATED: GSD Principles

**This reference has been consolidated into the gsd-planner agent.**

## Migration

Planning expertise is now baked into:
- `agents/gsd-planner.md` - Section: `<philosophy>`

## Why This Changed

The thin orchestrator pattern consolidates all planning methodology into the agent:
- Before: Reference files loaded separately (~74 lines)
- After: Agent has expertise baked in, orchestrator is thin

## Historical Reference

This file previously contained:
- Solo developer + Claude workflow philosophy
- "Plans are prompts" principle
- Scope control and quality degradation curve
- "Claude automates" and "ship fast" principles
- Anti-enterprise patterns

All content preserved in `agents/gsd-planner.md`.

---
*Deprecated: 2026-01-16*
*Replaced by: agents/gsd-planner.md*
