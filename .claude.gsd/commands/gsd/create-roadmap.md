---
name: gsd:create-roadmap
description: Create roadmap with phases for the project
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
  - Glob
  - Task
---

<!--
DEPRECATED: This command is now integrated into /gsd:new-project

The unified /gsd:new-project flow includes roadmap creation as Phase 8,
using the gsd-roadmapper agent for heavy lifting.

This standalone command is kept for users who want to:
- Recreate roadmap after significant scope changes
- Create roadmap for a project initialized before this integration
- Replace an existing roadmap

For new projects, use /gsd:new-project instead.

Deprecated: 2026-01-16
-->

<objective>
Create project roadmap with phase breakdown.

Roadmaps define what work happens in what order. Phases map to requirements.

**Note:** For new projects, `/gsd:new-project` includes roadmap creation. Use this command to recreate roadmap later.
</objective>

<execution_context>
@./.claude/get-shit-done/references/principles.md
@./.claude/get-shit-done/workflows/create-roadmap.md
@./.claude/get-shit-done/templates/roadmap.md
@./.claude/get-shit-done/templates/state.md
@./.claude/get-shit-done/references/goal-backward.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/config.json
@.planning/REQUIREMENTS.md
@.planning/research/SUMMARY.md (if exists)
</context>

<process>

<step name="validate">
```bash
# Verify project exists
[ -f .planning/PROJECT.md ] || { echo "ERROR: No PROJECT.md found. Run /gsd:new-project first."; exit 1; }

# Verify requirements exist
[ -f .planning/REQUIREMENTS.md ] || { echo "ERROR: No REQUIREMENTS.md found. Run /gsd:define-requirements first."; exit 1; }
```
</step>

<step name="check_existing">
Check if roadmap already exists:

```bash
[ -f .planning/ROADMAP.md ] && echo "ROADMAP_EXISTS" || echo "NO_ROADMAP"
```

**If ROADMAP_EXISTS:**
Use AskUserQuestion:
- header: "Roadmap exists"
- question: "A roadmap already exists. What would you like to do?"
- options:
  - "View existing" - Show current roadmap
  - "Replace" - Create new roadmap (will overwrite)
  - "Cancel" - Keep existing roadmap

If "View existing": `cat .planning/ROADMAP.md` and exit
If "Cancel": Exit
If "Replace": Continue with workflow
</step>

<step name="create_roadmap">
Follow the create-roadmap.md workflow starting from identify_phases step.

The workflow handles:
- Loading requirements
- Phase identification mapped to requirements
- Requirement coverage validation (no orphaned requirements)
- Research flags for each phase
- Confirmation gates (respecting config mode)
- ROADMAP.md creation with requirement mappings
- STATE.md initialization
- REQUIREMENTS.md traceability update
- Phase directory creation
- Git commit
</step>

<step name="done">
```
Roadmap created:
- Roadmap: .planning/ROADMAP.md
- State: .planning/STATE.md
- [N] phases defined

---

## ▶ Next Up

**Phase 1: [Name]** — [Goal from ROADMAP.md]

`/gsd:plan-phase 1`

<sub>`/clear` first → fresh context window</sub>

---

**Also available:**
- `/gsd:discuss-phase 1` — gather context first
- Review roadmap

---
```
</step>

</process>

<output>
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- `.planning/phases/XX-name/` directories
</output>

<success_criteria>
- [ ] PROJECT.md validated
- [ ] REQUIREMENTS.md validated
- [ ] All v1 requirements mapped to phases (no orphans)
- [ ] Success criteria derived for each phase (2-5 observable behaviors)
- [ ] Success criteria cross-checked against requirements (gaps resolved)
- [ ] ROADMAP.md created with phases, requirement mappings, and success criteria
- [ ] STATE.md initialized
- [ ] REQUIREMENTS.md traceability section updated
- [ ] Phase directories created
- [ ] Changes committed
</success_criteria>
