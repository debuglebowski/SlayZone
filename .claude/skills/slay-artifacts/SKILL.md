---
name: slay-artifacts
description: "Manage task artifacts (files, folders) via the slay CLI"
trigger: auto
---

Artifacts are files attached to tasks, stored on disk at `{data-dir}/artifacts/{taskId}/{artifactId}.ext`. They can be text files, images, or any binary content. Use artifacts to attach specifications, screenshots, logs, or any reference material to a task.

The `--task` flag defaults to `$SLAYZONE_TASK_ID` for `create`, `upload`, and `mkdir`. Note: `list` requires an explicit task ID argument.

## Files

- `slay tasks artifacts list <taskId> [--json] [--tree]` — list all artifacts for a task.
  - `--tree` shows an indented folder structure

- `slay tasks artifacts read <artifactId>` — output artifact content to stdout.
  - Binary artifacts (images, etc.) are written as raw buffers
  - Text artifacts as UTF-8

- `slay tasks artifacts create <title> [--task <id>] [--folder <id>] [--copy-from <path>] [--render-mode <mode>] [--json]` — create a new artifact.
  - Content is read from stdin (must be piped — errors on TTY), or from a file via `--copy-from`
  - Render mode is inferred from the title's file extension if not specified (defaults to plain text if no extension)
  - Reference created artifacts in task descriptions via `[title](artifact:<artifact-id>)`

- `slay tasks artifacts upload <sourcePath> [--task <id>] [--title <name>] [--json]` — upload a file from disk as an artifact.
  - Title defaults to the filename

- `slay tasks artifacts update <artifactId> [--title <name>] [--render-mode <mode>] [--json]` — update artifact metadata.
  - If the title changes and the file extension differs, the file is renamed on disk

- `slay tasks artifacts write <artifactId> [--mutate-version [ref]]` — replace the artifact's content entirely from stdin (pipe required).
  - Default: creates a new version
  - `--mutate-version` (bare): autosave to current version (auto-branches if locked)
  - `--mutate-version <ref>`: bypass lock and mutate the target version in place

- `slay tasks artifacts append <artifactId> [--mutate-version [ref]]` — append to the artifact's content from stdin (pipe required).
  - Versioning behavior same as `write`

- `slay tasks artifacts delete <artifactId>` — delete an artifact and its file.

- `slay tasks artifacts path <artifactId>` — print the artifact's absolute file path on disk.

## Folders

Artifacts can be organized into folders. Folder operations support cycle detection — you can't move a folder into its own child.

- `slay tasks artifacts mkdir <name> [--task <id>] [--parent <id>] [--json]` — create a folder, optionally nested under a parent.
- `slay tasks artifacts rmdir <folderId> [--json]` — delete a folder.
  - Contained artifacts are moved to root, not deleted
- `slay tasks artifacts mvdir <folderId> --parent <id|"root"> [--json]` — move a folder to a new parent.
  - Use `"root"` to move to top level
- `slay tasks artifacts mv <artifactId> --folder <id|"root"> [--json]` — move an artifact into a folder.
  - Use `"root"` for top level

## Versions

Every artifact has immutable, content-addressed version history. Writes via `write`/`append`/`create` or the app UI create new versions automatically. Versions can be referenced by: integer (`5`), hash prefix (`a1b2`), name (`milestone-1`), relative (`-1`, `-2`), or `HEAD~N`.

- `slay tasks artifacts versions list <artifactId> [--limit <n>] [--offset <n>] [--json]` — list version history, newest first.
  - Default limit: 50

- `slay tasks artifacts versions read <artifactId> <version>` — print content of a specific version to stdout.

- `slay tasks artifacts versions diff <artifactId> <a> [b] [--no-color] [--json]` — diff two versions.
  - `b` defaults to latest
  - Colorized output in TTY

- `slay tasks artifacts versions current <artifactId> [--json]` — print the current (HEAD) version.

- `slay tasks artifacts versions set-current <artifactId> <version> [--json]` — set the current (HEAD) version.
  - Flushes bytes to disk
  - Next UI save branches if the target is locked

- `slay tasks artifacts versions create <artifactId> [--name <name>] [--json]` — create a version from the working copy (no-op if content unchanged).

- `slay tasks artifacts versions rename <artifactId> <version> [newName] [--clear] [--json]` — set, change, or clear a version's name.
  - Use `--clear` or omit `newName` to clear
  - Named versions are protected from `prune`

- `slay tasks artifacts versions prune <artifactId> [--keep-last <n>] [--no-keep-named] [--no-keep-current] [--dry-run] [--json]` — remove old versions.
  - Named and current versions protected by default

## Download / Export

Download artifacts in various formats. Default type is `raw` (original file).

- `slay tasks artifacts download <artifactId> [--type raw|pdf|png|html] [--output <path>] [--json]` — download a single artifact.
- `slay tasks artifacts download --type zip [--task <id>] [--output <path>] [--json]` — download all task artifacts as a ZIP archive (no artifactId needed).

**Available types by render mode:**
| Type | Available for |
|------|--------------|
| raw  | all files |
| pdf  | markdown, code, html, svg, mermaid |
| png  | svg, mermaid |
| html | markdown, code, mermaid |
| zip  | all (task-level) |

`pdf`, `png`, and `html` exports require the SlayZone app to be running. `--output` defaults to the current directory with an auto-generated filename.

## Piping examples

```bash
echo "Meeting notes from standup" | slay tasks artifacts create "standup-notes.md"
cat report.csv | slay tasks artifacts write <artifactId>
curl -s https://example.com/data.json | slay tasks artifacts append <artifactId>
```
