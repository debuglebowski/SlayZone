---
name: gsd:research-project
description: Research domain ecosystem before creating roadmap
allowed-tools:
  - Read
  - Write
  - Bash
  - Task
  - AskUserQuestion
---

<!--
DEPRECATED: This command is now integrated into /gsd:new-project

The unified /gsd:new-project flow includes optional research as Phase 6.
This standalone command is kept for users who want to:
- Re-research a domain mid-project
- Research without running full new-project flow
- Add research after skipping it initially

For new projects, use /gsd:new-project instead.

Deprecated: 2026-01-16
-->

<objective>
Research domain ecosystem. Spawns 4 parallel gsd-project-researcher agents for comprehensive coverage.

**Orchestrator role:** Analyze project, generate research questions, spawn 4 parallel agents, synthesize SUMMARY.md.

**Why subagents:** Research burns context fast. Fresh 200k context per domain. Main context stays lean.

**Note:** For new projects, `/gsd:new-project` includes research as an optional step. Use this command to re-research or add research later.
</objective>

<context>
@.planning/PROJECT.md
@.planning/config.json (if exists)
</context>

<process>

## 1. Validate Prerequisites

```bash
[ -f .planning/PROJECT.md ] || { echo "ERROR: No PROJECT.md. Run /gsd:new-project first."; exit 1; }
[ -f .planning/ROADMAP.md ] && echo "WARNING: ROADMAP.md exists. Research is typically done before roadmap."
[ -d .planning/research ] && echo "RESEARCH_EXISTS" || echo "NO_RESEARCH"
```

## 2. Handle Existing Research

**If RESEARCH_EXISTS:** Use AskUserQuestion (View existing / Replace / Cancel)

## 3. Analyze Project

Read PROJECT.md, extract domain/stack/core value/constraints. Present for approval:
```
Domain analysis:
- Type: [domain]
- Stack: [stated or TBD]
- Core: [core value]
Does this look right? (yes / adjust)
```

## 4. Generate Research Questions

| Dimension | Question |
|-----------|----------|
| Stack | "What's the standard 2025 stack for [domain]?" |
| Features | "What features do [domain] products have?" |
| Architecture | "How are [domain] systems structured?" |
| Pitfalls | "What do [domain] projects get wrong?" |

Present for approval.

## 5. Spawn Research Agents

```bash
mkdir -p .planning/research
```

**Determine milestone context:**
- If no "Validated" requirements in REQUIREMENTS.md → Greenfield (v1.0)
- If "Validated" requirements exist → Subsequent milestone (v1.1+)

Spawn all 4 in parallel with rich context:

```
Task(prompt="
<research_type>
Project Research — Stack dimension for [domain].
</research_type>

<milestone_context>
{greenfield OR subsequent}

Greenfield: Research the standard stack for building [domain] from scratch.
Subsequent: Research what's needed to add [target features] to an existing [domain] app. Don't re-research the existing system.
</milestone_context>

<question>
[stack question from step 4]
</question>

<project_context>
[PROJECT.md summary]
</project_context>

<downstream_consumer>
Your STACK.md feeds into /gsd:create-roadmap. Be prescriptive:
- Specific libraries with versions
- Clear rationale for each choice
- What NOT to use and why
</downstream_consumer>

<quality_gate>
- [ ] Versions are current (not Claude's training data)
- [ ] Rationale explains WHY, not just WHAT
- [ ] Confidence levels assigned
</quality_gate>

<output>
Write to: .planning/research/STACK.md
Use template: ./.claude/get-shit-done/templates/research-project/STACK.md
</output>
", subagent_type="gsd-project-researcher", description="Stack research")

Task(prompt="
<research_type>
Project Research — Features dimension for [domain].
</research_type>

<milestone_context>
{greenfield OR subsequent}

Greenfield: What features do [domain] products have? What's table stakes vs differentiating?
Subsequent: How do [target features] typically work? What's expected behavior?
</milestone_context>

<question>
[features question from step 4]
</question>

<project_context>
[PROJECT.md summary]
</project_context>

<downstream_consumer>
Your FEATURES.md feeds into /gsd:define-requirements. Categorize clearly:
- Table stakes (must have or users leave)
- Differentiators (competitive advantage)
- Anti-features (things to deliberately NOT build)
</downstream_consumer>

<quality_gate>
- [ ] Categories are clear
- [ ] Complexity noted for each
- [ ] Dependencies between features identified
</quality_gate>

<output>
Write to: .planning/research/FEATURES.md
Use template: ./.claude/get-shit-done/templates/research-project/FEATURES.md
</output>
", subagent_type="gsd-project-researcher", description="Features research")

Task(prompt="
<research_type>
Project Research — Architecture dimension for [domain].
</research_type>

<milestone_context>
{greenfield OR subsequent}

Greenfield: How are [domain] systems typically structured? What are major components?
Subsequent: How do [target features] integrate with existing [domain] architecture?
</milestone_context>

<question>
[architecture question from step 4]
</question>

<project_context>
[PROJECT.md summary]
</project_context>

<downstream_consumer>
Your ARCHITECTURE.md informs phase structure in roadmap. Include:
- Component boundaries (what talks to what)
- Data flow (how information moves)
- Suggested build order (dependencies between components)
</downstream_consumer>

<quality_gate>
- [ ] Components clearly defined
- [ ] Boundaries explicit
- [ ] Build order implications noted
</quality_gate>

<output>
Write to: .planning/research/ARCHITECTURE.md
Use template: ./.claude/get-shit-done/templates/research-project/ARCHITECTURE.md
</output>
", subagent_type="gsd-project-researcher", description="Architecture research")

Task(prompt="
<research_type>
Project Research — Pitfalls dimension for [domain].
</research_type>

<milestone_context>
{greenfield OR subsequent}

Greenfield: What do [domain] projects commonly get wrong? Critical mistakes?
Subsequent: What are common mistakes when adding [target features] to [domain]?
</milestone_context>

<question>
[pitfalls question from step 4]
</question>

<project_context>
[PROJECT.md summary]
</project_context>

<downstream_consumer>
Your PITFALLS.md prevents mistakes in roadmap/planning. For each pitfall:
- Warning signs (how to detect early)
- Prevention strategy (how to avoid)
- Which phase should address it
</downstream_consumer>

<quality_gate>
- [ ] Pitfalls are specific, not generic
- [ ] Prevention is actionable
- [ ] Phase mapping included
</quality_gate>

<output>
Write to: .planning/research/PITFALLS.md
Use template: ./.claude/get-shit-done/templates/research-project/PITFALLS.md
</output>
", subagent_type="gsd-project-researcher", description="Pitfalls research")
```

**Announce:** "Spawning 4 research agents... may take 2-3 minutes."

## 6. Synthesize Results

After all agents complete, read their outputs and write `.planning/research/SUMMARY.md`:
- Read template: `./.claude/get-shit-done/templates/research-project/SUMMARY.md`
- Synthesize executive summary from all 4 files
- Add confidence assessment

**Critical: Include "Implications for Roadmap" section:**

```markdown
## Implications for Roadmap

Based on research, suggested phase structure:

1. **[Phase name]** — [rationale from research]
   - Addresses: [features from FEATURES.md]
   - Avoids: [pitfall from PITFALLS.md]
   - Uses: [stack element from STACK.md]

2. **[Phase name]** — [rationale from research]
   - Implements: [architecture component from ARCHITECTURE.md]
   ...

**Phase ordering rationale:**
- [Why this order based on dependencies discovered in ARCHITECTURE.md]
- [Why this grouping based on PITFALLS.md prevention strategies]

**Research flags for phases:**
- Phase [X]: Likely needs deeper research (reason)
- Phase [Y]: Standard patterns, unlikely to need research
```

This section directly feeds into `/gsd:create-roadmap`.

## 7. Commit Research

```bash
git add .planning/research/
git commit -m "docs: research [domain] ecosystem

Key findings:
- Stack: [one-liner]
- Architecture: [one-liner]
- Critical pitfall: [one-liner]"
```

## 8. Present Results

```
Research complete:

Files: SUMMARY.md, STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md

Key findings:
- Stack: [one-liner]
- Architecture: [one-liner]
- Critical pitfall: [one-liner]

---
## > Next Up
**Define requirements** - `/gsd:define-requirements`
<sub>`/clear` first</sub>
---
```

</process>

<success_criteria>
- [ ] PROJECT.md validated
- [ ] Domain identified and approved
- [ ] 4 gsd-project-researcher agents spawned in parallel
- [ ] All research files created
- [ ] SUMMARY.md synthesized with roadmap implications
- [ ] Research committed
</success_criteria>
