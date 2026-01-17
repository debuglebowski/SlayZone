---
name: gsd:define-requirements
description: Define what "done" looks like with checkable requirements
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - AskUserQuestion
---

<!--
DEPRECATED: This command is now integrated into /gsd:new-project

The unified /gsd:new-project flow includes requirements definition as Phase 7.
This standalone command is kept for users who want to:
- Redefine requirements mid-project
- Add new requirements after initial project setup
- Adjust v1/v2 scope boundaries

For new projects, use /gsd:new-project instead.

Deprecated: 2026-01-16
-->

<objective>
Define concrete, checkable requirements for v1.

Two modes:
1. **With research** — Transform FEATURES.md into scoped requirements
2. **Without research** — Gather requirements through questioning

Output: `.planning/REQUIREMENTS.md`

**Note:** For new projects, `/gsd:new-project` includes requirements definition. Use this command to redefine requirements later.
</objective>

<execution_context>
@./.claude/get-shit-done/references/principles.md
@./.claude/get-shit-done/workflows/define-requirements.md
@./.claude/get-shit-done/templates/requirements.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/research/FEATURES.md (if exists)
@.planning/research/SUMMARY.md (if exists)
</context>

<process>

<step name="validate">
```bash
# Verify project exists
[ -f .planning/PROJECT.md ] || { echo "ERROR: No PROJECT.md found. Run /gsd:new-project first."; exit 1; }

# Check for research
[ -f .planning/research/FEATURES.md ] && echo "HAS_RESEARCH" || echo "NO_RESEARCH"

# Check if requirements already exist
[ -f .planning/REQUIREMENTS.md ] && echo "REQUIREMENTS_EXISTS" || echo "NO_REQUIREMENTS"
```
</step>

<step name="check_existing">
**If REQUIREMENTS_EXISTS:**

Use AskUserQuestion:
- header: "Requirements exist"
- question: "Requirements already defined. What would you like to do?"
- options:
  - "View existing" — Show current requirements
  - "Replace" — Define requirements fresh (will overwrite)
  - "Cancel" — Keep existing requirements

If "View existing": Read and display `.planning/REQUIREMENTS.md`, then exit
If "Cancel": Exit
If "Replace": Continue with workflow
</step>

<step name="execute">
**If HAS_RESEARCH:**
Follow the define-requirements.md workflow:
- Load research features from FEATURES.md
- Present features by category
- Ask user to scope each category (v1 / v2 / out of scope)
- Capture any additions research missed
- Generate REQUIREMENTS.md with checkable list

**If NO_RESEARCH:**
Gather requirements through questioning:
- Read PROJECT.md for core value and context
- Ask: "What are the main things users need to be able to do?"
- For each capability mentioned, probe for specifics
- Group into categories (Authentication, Content, etc.)
- For each category, ask what's v1 vs v2 vs out of scope
- Generate REQUIREMENTS.md with checkable list

Same output format either way — the difference is source (research vs conversation).
</step>

<step name="done">
```
Requirements defined:

- Requirements: .planning/REQUIREMENTS.md
- v1 scope: [N] requirements across [M] categories
- v2 scope: [X] requirements deferred
- Out of scope: [Y] requirements excluded

---

## ▶ Next Up

**Create roadmap** — phases mapped to requirements

`/gsd:create-roadmap`

<sub>`/clear` first → fresh context window</sub>

---
```
</step>

</process>

<success_criteria>
- [ ] PROJECT.md validated
- [ ] Features gathered (from research OR questioning)
- [ ] User scoped each category (v1/v2/out of scope)
- [ ] User had opportunity to add missing requirements
- [ ] REQUIREMENTS.md created with checkable list
- [ ] Requirements committed to git
- [ ] User knows next step (create-roadmap)
</success_criteria>
