---
name: gsd:verify-work
description: Validate built features through conversational UAT
argument-hint: "[phase number, e.g., '4']"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - Edit
  - Write
---

<objective>
Validate built features through conversational testing with persistent state.

Purpose: Confirm what Claude built actually works from user's perspective. One test at a time, plain text responses, no interrogation.

Output: {phase}-UAT.md tracking all test results, gaps logged for /gsd:plan-phase --gaps
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/verify-work.md
@./.claude/get-shit-done/templates/UAT.md
</execution_context>

<context>
Phase: $ARGUMENTS (optional)
- If provided: Test specific phase (e.g., "4")
- If not provided: Check for active sessions or prompt for phase

@.planning/STATE.md
@.planning/ROADMAP.md
</context>

<process>
1. Check for active UAT sessions (resume or start new)
2. Find SUMMARY.md files for the phase
3. Extract testable deliverables (user-observable outcomes)
4. Create {phase}-UAT.md with test list
5. Present tests one at a time:
   - Show expected behavior
   - Wait for plain text response
   - "yes/y/next" = pass, anything else = issue (severity inferred)
6. Update UAT.md after each response
7. On completion: commit, present summary, offer next steps
</process>

<anti_patterns>
- Don't use AskUserQuestion for test responses — plain text conversation
- Don't ask severity — infer from description
- Don't present full checklist upfront — one test at a time
- Don't run automated tests — this is manual user validation
- Don't fix issues during testing — log as gaps for /gsd:plan-phase --gaps
</anti_patterns>

<success_criteria>
- [ ] UAT.md created with tests from SUMMARY.md
- [ ] Tests presented one at a time with expected behavior
- [ ] Plain text responses (no structured forms)
- [ ] Severity inferred, never asked
- [ ] Batched writes: on issue, every 5 passes, or completion
- [ ] Committed on completion
- [ ] Clear next steps based on results
</success_criteria>
