---
name: commit
description: "Commit the changes that has been worked on in this session"
trigger: auto
---

Prepare a git commit for the current task. User context: $ARGUMENTS

## Default scope: this session only

**Unless the user says otherwise, commit ONLY the changes made in the current session.** Do not include pre-existing modifications, untracked files from earlier work, or edits the user made manually outside this session — even if they are staged or in the working tree.

Override signals (commit broader scope only when user explicitly says): "commit everything", "commit all", "include the other changes", "stage X too", or names specific files outside the session set.

## Workflow

1. Inspect repository state.
- Run `git status --short`.
- Run `git diff --name-only` and `git diff --cached --name-only`.
- Cross-reference against this session's tool-call history (Edit/Write/MultiEdit targets) to identify which files this session actually touched.

2. Build a candidate set from this session's work only.
- Include only files and hunks this session created or edited.
- Exclude pre-existing, unrelated, or user-authored edits that were not part of this session — even if they appear in `git status`.
- If confidence is not high for any file or hunk (e.g. session edited part of a file, but other hunks predate session), mark it as uncertain.

3. Resolve uncertainty before staging.
- If any file or hunk is uncertain, stop and ask the user exactly what to include.
- Ask with explicit paths/hunks so the user can approve or exclude each uncertain change.
- Do not commit until all uncertain items are resolved.

4. Stage explicit paths/hunks only.
- Use `git add <file1> <file2> ...`.
- Use `git add -p <file>` when only part of a file belongs in this commit.
- Do not use `git add .` or `git add -A` unless the user explicitly asks to commit everything.

5. Validate staged content.
- Run `git diff --cached`.
- Confirm staged hunks are only this session's edits and do not include accidental or unrelated changes.

6. Write a Conventional Commit message.
- Use one type: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`.
- Optional scope format: `type(scope): summary`.
- Keep the subject concise and imperative.

7. Commit non-interactively.
- Run `git commit -m "<message>"`.
- Do not use interactive commit flows.
- Do not amend existing commits unless the user explicitly asks.

8. Report completion.
- Provide commit hash, commit subject, and file list.
- Also report remaining modified or untracked files.

## Safety rules

- Never revert user changes unless explicitly instructed.
- Never run destructive commands (`git reset --hard`, force checkout) unless explicitly instructed.
- Never include a change with unclear ownership; ask the user first.
- Prefer one focused commit per user request unless asked to split into multiple commits.
