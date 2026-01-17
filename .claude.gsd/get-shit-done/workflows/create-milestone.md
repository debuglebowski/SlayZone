<purpose>
Start a new milestone cycle by updating PROJECT.md with new goals.

This is the brownfield equivalent of new-project. The project exists and has history.
This workflow gathers "what's next" and updates PROJECT.md, then routes to the
requirements → roadmap cycle.
</purpose>

<required_reading>
**Read these files NOW:**

1. ./.claude/get-shit-done/references/questioning.md
2. ./.claude/get-shit-done/templates/project.md
3. `.planning/PROJECT.md`
4. `.planning/MILESTONES.md` (if exists)
5. `.planning/STATE.md`
</required_reading>

<process>

<step name="load_context">
Load project context:

```bash
cat .planning/PROJECT.md
cat .planning/MILESTONES.md 2>/dev/null || echo "No milestones file yet"
cat .planning/STATE.md
cat .planning/MILESTONE-CONTEXT.md 2>/dev/null || echo "No milestone context file"
cat .planning/config.json 2>/dev/null
```

Extract:
- What shipped previously (from MILESTONES.md)
- Current Validated requirements (from PROJECT.md)
- Pending todos and blockers (from STATE.md)
- Any context from discuss-milestone (MILESTONE-CONTEXT.md)

**Calculate next milestone version:**
- Parse last version from MILESTONES.md
- If v1.0 → suggest v1.1 (minor) or v2.0 (major)
- If v1.3 → suggest v1.4 or v2.0
</step>

<step name="gather_goals">
**If MILESTONE-CONTEXT.md exists (from /gsd:discuss-milestone):**
- Use features and scope already gathered
- Present summary for confirmation
- Skip to confirm_goals step

**If no context file:**

Present what shipped:
```
Last milestone: v[X.Y] [Name]
Key accomplishments:
- [From MILESTONES.md]

Validated so far:
- [From PROJECT.md Validated section]

Pending todos:
- [From STATE.md if any]
```

Ask (freeform, not AskUserQuestion):
"What do you want to build in the next milestone?"

Wait for response. Then use AskUserQuestion to explore:
- Probe specific features mentioned
- Ask about priorities
- Surface constraints or dependencies
- Clarify scope boundaries

Continue until you have clear milestone goals.
</step>

<step name="confirm_goals">
Present gathered goals:

```
Milestone: v[X.Y] [Name]

Goal: [One sentence focus]

Target features:
- [Feature 1]
- [Feature 2]
- [Feature 3]

Ready to update PROJECT.md? (yes / adjust)
```

If "adjust": return to gather_goals.
</step>

<step name="update_project">
Update `.planning/PROJECT.md`:

**Add Current Milestone section** (after Core Value, before Requirements):

```markdown
## Current Milestone: v[X.Y] [Name]

**Goal:** [One sentence describing milestone focus]

**Target features:**
- [Feature 1]
- [Feature 2]
- [Feature 3]
```

**Update Active requirements:**
- Add new milestone goals to Active section
- Keep existing Active items that weren't addressed
- Don't remove anything from Validated

**Update footer:**
```markdown
---
*Last updated: [date] after v[X.Y] milestone start*
```
</step>

<step name="update_state">
Update `.planning/STATE.md`:

```markdown
## Current Position

Phase: Not started (run /gsd:create-roadmap)
Plan: —
Status: Defining requirements
Last activity: [today] — Milestone v[X.Y] started

Progress: ░░░░░░░░░░ 0%
```

Keep Accumulated Context (decisions, blockers) from previous milestone.
</step>

<step name="cleanup">
Delete temporary context file if it exists:

```bash
rm -f .planning/MILESTONE-CONTEXT.md
```
</step>

<step name="git_commit">
```bash
git add .planning/PROJECT.md .planning/STATE.md
git commit -m "$(cat <<'EOF'
docs: start milestone v[X.Y] [Name]

Goal: [One sentence]
Target features: [count] features
EOF
)"
```
</step>

<step name="offer_next">
```
Milestone v[X.Y] [Name] initialized.

PROJECT.md updated with:
- Current Milestone section
- Target features in Active requirements

---

## ▶ Next Up

**Define Requirements** — scope v[X.Y] features into REQUIREMENTS.md

`/gsd:define-requirements`

<sub>`/clear` first → fresh context window</sub>

---

**Or research first:**
- `/gsd:research-project` — investigate ecosystem before scoping

**Full flow:**
1. `/gsd:define-requirements` — create REQUIREMENTS.md
2. `/gsd:create-roadmap` — create ROADMAP.md with phases
3. `/gsd:plan-phase [N]` — start execution

---
```
</step>

</process>

<success_criteria>
- PROJECT.md updated with Current Milestone section
- Active requirements reflect new milestone goals
- STATE.md reset for new milestone (keeps accumulated context)
- MILESTONE-CONTEXT.md consumed and deleted (if existed)
- Git commit made
- User routed to define-requirements (or research-project)
</success_criteria>
