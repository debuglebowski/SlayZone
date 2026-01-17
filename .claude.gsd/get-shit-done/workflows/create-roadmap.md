<purpose>
Define the phases of implementation. Each phase is a coherent chunk of work
that delivers value. Phases map to requirements — every v1 requirement must
belong to exactly one phase.

The roadmap provides structure, not detailed tasks. But it ensures no
requirements are orphaned and validates coverage before planning begins.
</purpose>

<required_reading>
**Read these files NOW:**

1. ./.claude/get-shit-done/templates/roadmap.md
2. ./.claude/get-shit-done/templates/state.md
3. ./.claude/get-shit-done/templates/requirements.md
4. .planning/PROJECT.md
5. .planning/REQUIREMENTS.md
6. .planning/research/SUMMARY.md (if exists)
</required_reading>

<process>

<step name="load_requirements">
Load and parse REQUIREMENTS.md:

```bash
cat .planning/REQUIREMENTS.md
```

Extract:
- All v1 requirement IDs (AUTH-01, CONT-02, etc.)
- Requirement categories (Authentication, Content, Social, etc.)
- Total count of v1 requirements

```
Requirements loaded:

Categories: [N]
- Authentication: [X] requirements
- Content: [Y] requirements
- Social: [Z] requirements
...

Total v1 requirements: [N]

All requirements must map to exactly one phase.
```

**Track requirement IDs** — will verify coverage after phase identification.
</step>

<step name="check_brief">
```bash
cat .planning/PROJECT.md 2>/dev/null || echo "No brief found"
```

**If no brief exists:**
Ask: "No brief found. Want to create one first, or proceed with roadmap?"

If proceeding without brief, gather quick context:

- What are we building?
- What's the rough scope?
</step>

<step name="load_research">
Check for project research:

```bash
[ -d .planning/research ] && echo "RESEARCH_EXISTS" || echo "NO_RESEARCH"
```

**If RESEARCH_EXISTS:**

Read `.planning/research/SUMMARY.md` and extract:
- Suggested phase structure from "Implications for Roadmap" section
- Research flags for each suggested phase
- Key findings that inform phase ordering

```
Research found. Using findings to inform roadmap:

Suggested phases from research:
1. [Phase from research] — [rationale]
2. [Phase from research] — [rationale]
3. [Phase from research] — [rationale]

Research confidence: [HIGH/MEDIUM/LOW]

Proceeding with research-informed phase identification...
```

**If NO_RESEARCH:**

Continue without research context. Phase identification will rely on PROJECT.md only.

**Note:** Research is optional. Roadmap can be created without it, but research-informed roadmaps tend to have better phase structure and fewer surprises.
</step>

<step name="identify_phases">
Derive phases from requirements. Each phase covers a coherent set of requirements.

**Primary input: REQUIREMENTS.md**
- Group requirements by natural delivery boundaries
- Each phase should complete one or more requirement categories
- Dependencies between requirements inform phase ordering

**Secondary inputs:**
- Research SUMMARY.md (if exists): suggested phases, architecture patterns

**Phase identification process:**

1. Group requirements by category (Authentication, Content, Social, etc.)
2. Identify dependencies between categories (Social needs Content, Content needs Auth)
3. Create phases that complete entire categories where possible
4. Split large categories across phases if needed (e.g., basic auth vs. advanced auth)
5. Assign every v1 requirement to exactly one phase

**For each phase, record:**
- Phase name and goal
- Which requirement IDs it covers (e.g., AUTH-01, AUTH-02, AUTH-03)
- Dependencies on other phases

**Check depth setting:**
```bash
cat .planning/config.json 2>/dev/null | grep depth
```

<depth_guidance>
**Depth controls compression tolerance, not artificial inflation.**

| Depth | Typical Phases | Typical Plans/Phase | Tasks/Plan |
|-------|----------------|---------------------|------------|
| Quick | 3-5 | 1-3 | 2-3 |
| Standard | 5-8 | 3-5 | 2-3 |
| Comprehensive | 8-12 | 5-10 | 2-3 |

**Key principle:** Derive phases from actual work. Depth determines how aggressively you combine things, not a target to hit.

- Comprehensive auth system = 8 phases (because auth genuinely has 8 concerns)
- Comprehensive "add favicon" = 1 phase (because that's all it is)

For comprehensive depth:
- Don't compress multiple features into single phases
- Each major capability gets its own phase
- Let small things stay small—don't pad to hit a number
- If you're tempted to combine two things, make them separate phases instead

For quick depth:
- Combine related work aggressively
- Focus on critical path only
- Defer nice-to-haves to future milestones
</depth_guidance>

**Phase Numbering System:**

**Calculate starting phase number:**

```bash
# Find highest existing phase number from phases/ directory
ls -d .planning/phases/[0-9]*-* 2>/dev/null | sort -V | tail -1 | grep -oE '[0-9]+' | head -1
```

- If phases/ is empty or doesn't exist: start at Phase 1
- If phases exist from previous milestone: continue from last + 1
- Example: v1.0 had phases 1-4, v1.1 starts at Phase 5

Use integer phases (1, 2, 3) for planned milestone work.

Use decimal phases (2.1, 2.2) for urgent insertions:

- Decimal phases inserted between integers (2.1 between 2 and 3)
- Mark with "(INSERTED)" in phase title
- Created when urgent work discovered after planning
- Examples: bugfixes, hotfixes, critical patches

**When to use decimals:**

- Urgent work that can't wait for next milestone
- Critical bugs blocking progress
- Security patches needing immediate attention
- NOT for scope creep or "nice to haves" (capture with /gsd:add-todo instead)

**Phase execution order:**
Numeric sort: 1 → 1.1 → 1.2 → 2 → 2.1 → 3

**Deriving phases:**

1. List all distinct systems/features/capabilities required
2. Group related work into coherent deliverables
3. Each phase should deliver ONE complete, verifiable thing
4. If a phase delivers multiple unrelated capabilities: split it
5. If a phase can't stand alone as a complete deliverable: merge it
6. Order by dependencies

Good phases are:

- **Coherent**: Each delivers one complete, verifiable capability
- **Sequential**: Later phases build on earlier
- **Independent**: Can be verified and committed on its own

Common phase patterns:

- Foundation → Core Feature → Enhancement → Polish
- Setup → MVP → Iteration → Launch
- Infrastructure → Backend → Frontend → Integration
  </step>

<step name="derive_phase_success_criteria">
**For each phase, derive what must be TRUE when it completes.**

This catches scope gaps before planning begins. Requirements tell us what to build; success criteria tell us what users can do.

**Process for each phase:**

1. **State the phase goal** (from identify_phases)

2. **Ask: "What must be TRUE for users when this phase completes?"**
   - Think from user's perspective, not implementation
   - 2-5 observable behaviors per phase
   - Each should be testable/verifiable

3. **Cross-check against mapped requirements:**
   - Does each success criterion have at least one requirement supporting it?
   - Does each requirement contribute to at least one success criterion?

4. **Flag gaps:**
   - Success criterion with no supporting requirement → Add requirement or mark as out of scope
   - Requirement that supports no criterion → Question if it belongs in this phase

**Example:**

```
Phase 2: Authentication
Goal: Users can securely access their accounts

Success Criteria (what must be TRUE):
1. User can create account with email/password
2. User can log in and stay logged in across browser sessions
3. User can log out from any page
4. User can reset forgotten password

Requirements mapped: AUTH-01, AUTH-02, AUTH-03

Cross-check:
✓ Criterion 1 ← AUTH-01 (create account)
✓ Criterion 2 ← AUTH-02 (log in) — but "stay logged in" needs session persistence
✓ Criterion 3 ← AUTH-03 (log out)
✗ Criterion 4 ← No requirement covers password reset

Gap found: Password reset not in requirements.
→ Add AUTH-04: User can reset password via email
   OR mark "Password reset" as v2 scope
```

**Present to user:**

```
Phase success criteria derived:

Phase 1: Foundation
Goal: Project scaffolding and configuration
Success criteria:
  1. Project builds without errors
  2. Development server runs locally
  3. CI pipeline passes
Requirements: SETUP-01, SETUP-02 ✓ (all criteria covered)

Phase 2: Authentication
Goal: Users can securely access their accounts
Success criteria:
  1. User can create account with email/password
  2. User can log in and stay logged in across sessions
  3. User can log out from any page
  4. User can reset forgotten password ⚠️
Requirements: AUTH-01, AUTH-02, AUTH-03
Gap: Criterion 4 (password reset) has no requirement

Phase 3: User Profile
...

---

⚠️ 1 gap found in Phase 2

Options:
1. Add AUTH-04 for password reset
2. Mark password reset as v2 scope
3. Adjust success criteria
```

**Resolve all gaps before proceeding.**

Success criteria flow downstream:
- Written to ROADMAP.md (high-level, user-observable)
- Inform `must_haves` derivation in plan-phase (concrete artifacts/wiring)
- Verified by verify-phase after execution
</step>

<step name="validate_coverage">
**Verify all v1 requirements are mapped to exactly one phase.**

Compare assigned requirements against full list from load_requirements step:

```
Requirement Coverage:

✓ AUTH-01 → Phase 1
✓ AUTH-02 → Phase 1
✓ AUTH-03 → Phase 1
✓ AUTH-04 → Phase 1
✓ PROF-01 → Phase 2
✓ PROF-02 → Phase 2
...

Coverage: [X]/[Y] requirements mapped
```

**If any requirements unmapped:**

```
⚠️ Orphaned requirements (not in any phase):

- NOTF-01: User receives in-app notifications
- NOTF-02: User receives email for new followers

These v1 requirements have no phase. Options:
1. Add phase to cover them
2. Move to v2 (update REQUIREMENTS.md)
3. Assign to existing phase
```

Use AskUserQuestion to resolve orphaned requirements.

**Do not proceed until coverage = 100%.**
</step>

<step name="confirm_phases">
<config-check>
```bash
cat .planning/config.json 2>/dev/null
```
Note: Config may not exist yet (project initialization). If missing, default to interactive mode.
</config-check>

<if mode="yolo">
```
⚡ Auto-approved: Phase breakdown ([N] phases)

1. [Phase name] - [goal]
2. [Phase name] - [goal]
3. [Phase name] - [goal]

Proceeding to research detection...
```

Proceed directly to detect_research_needs step.
</if>

<if mode="interactive" OR="missing OR custom with gates.confirm_phases true">
Present the phase breakdown inline:

"Here's how I'd break this down:

1. [Phase name] - [goal]
2. [Phase name] - [goal]
3. [Phase name] - [goal]
   ...

Does this feel right? (yes / adjust)"

If "adjust": Ask what to change, revise, present again.
</step>

<step name="decision_gate">
<if mode="yolo">
```
⚡ Auto-approved: Create roadmap with [N] phases

Proceeding to create .planning/ROADMAP.md...
```

Proceed directly to create_structure step.
</if>

<if mode="interactive" OR="missing OR custom with gates.confirm_roadmap true">
Use AskUserQuestion:

- header: "Ready"
- question: "Ready to create the roadmap, or would you like me to ask more questions?"
- options:
  - "Create roadmap" - I have enough context
  - "Ask more questions" - There are details to clarify
  - "Let me add context" - I want to provide more information

Loop until "Create roadmap" selected.
</step>

<step name="create_structure">
```bash
mkdir -p .planning/phases
```
</step>

<step name="write_roadmap">
Use template from `./.claude/get-shit-done/templates/roadmap.md`.

Initial roadmaps use integer phases (1, 2, 3...).
Decimal phases added later via /gsd:insert-phase command (if it exists).

Write to `.planning/ROADMAP.md` with:

- Phase list with names and one-line descriptions
- Dependencies (what must complete before what)
- **Requirement mappings** (which REQ-IDs each phase covers):
  ```markdown
  ### Phase 1: Authentication
  **Goal**: Secure user authentication
  **Depends on**: Nothing (first phase)
  **Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04
  ```
- Status tracking (all start as "not started")

Create phase directories:

```bash
mkdir -p .planning/phases/01-{phase-name}
mkdir -p .planning/phases/02-{phase-name}
# etc.
```

</step>

<step name="update_requirements_traceability">
Update REQUIREMENTS.md traceability section with phase mappings:

Read current REQUIREMENTS.md and update the Traceability table:

```markdown
## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| AUTH-04 | Phase 1 | Pending |
| PROF-01 | Phase 2 | Pending |
...

**Coverage:**
- v1 requirements: [X] total
- Mapped to phases: [X]
- Unmapped: 0 ✓
```

Write updated REQUIREMENTS.md.
</step>

<step name="initialize_project_state">

Create or update STATE.md — the project's living memory.

```bash
[ -f .planning/STATE.md ] && echo "STATE_EXISTS" || echo "NEW_STATE"
```

**If STATE_EXISTS:** Update Current Position and keep Accumulated Context.
**If NEW_STATE:** Create fresh using template from `./.claude/get-shit-done/templates/state.md`.

Write to `.planning/STATE.md`:

```markdown
# Project State

## Project Reference

See: .planning/PROJECT.md (updated [today's date])

**Core value:** [Copy Core Value from PROJECT.md]
**Current focus:** Phase 1 — [First phase name]

## Current Position

Phase: 1 of [N] ([First phase name])
Plan: Not started
Status: Ready to plan
Last activity: [today's date] — Project initialized

Progress: ░░░░░░░░░░ 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| — | — | — | — |

**Recent Trend:**
- Last 5 plans: —
- Trend: —

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

(None yet)

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: [today's date and time]
Stopped at: Project initialization complete
Resume file: None
```

**Key points:**

- Project Reference points to PROJECT.md for full context
- Claude reads PROJECT.md directly for requirements, constraints, decisions
- This file will be read first in every future operation
- This file will be updated after every execution

</step>

<step name="git_commit_initialization">
Commit roadmap with requirement mappings:

```bash
git add .planning/ROADMAP.md .planning/STATE.md .planning/REQUIREMENTS.md
git add .planning/phases/
git commit -m "$(cat <<'EOF'
docs: create roadmap ([N] phases, [X] requirements)

[One-liner from PROJECT.md]

Phases:
1. [phase-name]: [requirements covered]
2. [phase-name]: [requirements covered]
3. [phase-name]: [requirements covered]

All v1 requirements mapped to phases.
EOF
)"
```

Confirm: "Committed: docs: create roadmap ([N] phases, [X] requirements)"
</step>

<step name="offer_next">
```
Project initialized:
- Brief: .planning/PROJECT.md
- Roadmap: .planning/ROADMAP.md
- State: .planning/STATE.md
- Committed as: docs: initialize [project] ([N] phases)

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

<phase_naming>
Use `XX-kebab-case-name` format:
- `01-foundation`
- `02-authentication`
- `03-core-features`
- `04-polish`

Numbers ensure ordering. Names describe content.
</phase_naming>

<anti_patterns>
- Don't add time estimates
- Don't create Gantt charts
- Don't add resource allocation
- Don't include risk matrices
- Don't impose arbitrary phase counts (let the work determine the count)

Phases are buckets of work, not project management artifacts.
</anti_patterns>

<success_criteria>
Roadmap is complete when:
- [ ] REQUIREMENTS.md loaded and parsed
- [ ] All v1 requirements mapped to exactly one phase (100% coverage)
- [ ] **Success criteria derived** for each phase (2-5 observable behaviors)
- [ ] **Success criteria cross-checked** against requirements (no gaps)
- [ ] `.planning/ROADMAP.md` exists with requirement mappings and success criteria
- [ ] `.planning/STATE.md` exists (project memory initialized)
- [ ] REQUIREMENTS.md traceability section updated
- [ ] Phases defined with clear names (count derived from requirements, not imposed)
- [ ] **Research flags assigned** (Likely/Unlikely for each phase)
- [ ] **Research topics listed** for Likely phases
- [ ] Phase directories created
- [ ] Dependencies noted if any
- [ ] Status tracking in place
</success_criteria>
```
