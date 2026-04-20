---
name: slay-assets
description: "Manage task assets (files, folders) via the slay CLI"
trigger: auto
---

Assets are files attached to tasks, stored on disk at `{data-dir}/assets/{taskId}/{assetId}.ext`. They can be text files, images, or any binary content. Use assets to attach specifications, screenshots, logs, or any reference material to a task.

The `--task` flag defaults to `$SLAYZONE_TASK_ID` for `create`, `upload`, and `mkdir`. Note: `list` requires an explicit task ID argument.

## Files

- `slay tasks assets list <taskId> [--json] [--tree]`
  List all assets for a task. `--tree` shows an indented folder structure.

- `slay tasks assets read <assetId>`
  Output asset content to stdout. Binary assets (images, etc.) are written as raw buffers; text assets as UTF-8.

- `slay tasks assets create <title> [--task <id>] [--folder <id>] [--copy-from <path>] [--render-mode <mode>] [--json]`
  Create a new asset. Content is read from stdin (must be piped — errors on TTY), or from a file via `--copy-from`. The render mode is inferred from the title's file extension if not specified (defaults to plain text if no extension). Reference created assets in task descriptions via `[title](asset:<asset-id>)`.

- `slay tasks assets upload <sourcePath> [--task <id>] [--title <name>] [--json]`
  Upload a file from disk as an asset. Title defaults to the filename.

- `slay tasks assets update <assetId> [--title <name>] [--render-mode <mode>] [--json]`
  Update asset metadata. If the title changes and the file extension differs, the file is renamed on disk.

- `slay tasks assets write <assetId>`
  Replace the asset's content entirely. Reads from stdin (pipe required).

- `slay tasks assets append <assetId>`
  Append to the asset's content. Reads from stdin (pipe required).

- `slay tasks assets delete <assetId>` — delete an asset and its file.

- `slay tasks assets path <assetId>` — print the asset's absolute file path on disk.

## Folders

Assets can be organized into folders. Folder operations support cycle detection — you can't move a folder into its own child.

- `slay tasks assets mkdir <name> [--task <id>] [--parent <id>] [--json]` — create a folder, optionally nested under a parent.
- `slay tasks assets rmdir <folderId> [--json]` — delete a folder. Contained assets are moved to root, not deleted.
- `slay tasks assets mvdir <folderId> --parent <id|"root"> [--json]` — move a folder to a new parent. Use `"root"` to move to top level.
- `slay tasks assets mv <assetId> --folder <id|"root"> [--json]` — move an asset into a folder. Use `"root"` for top level.

## Download / Export

Download assets in various formats. Default type is `raw` (original file).

- `slay tasks assets download <assetId> [--type raw|pdf|png|html] [--output <path>] [--json]` — download a single asset.
- `slay tasks assets download --type zip [--task <id>] [--output <path>] [--json]` — download all task assets as a ZIP archive (no assetId needed).

**Available types by render mode:**
| Type | Available for |
|------|--------------|
| raw  | all files |
| pdf  | markdown, code, html, svg, mermaid |
| png  | svg, mermaid |
| html | markdown, code, mermaid |
| zip  | all (task-level) |

`pdf`, `png`, and `html` exports require the SlayZone app to be running. `--output` defaults to the current directory with an auto-generated filename.

## Versions

Every asset has a linear version history. Writing creates a new version by default; `--mutate-version` amends the latest in place. Restoring an old version is a pipe: `read | write`. The CLI sets `author = 'agent'` when `$SLAYZONE_AGENT_MODE` is set, else `'user'`.

`<version>` accepts: int (`3`), hash prefix (`a1b2`), name (`before-refactor`), relative (`-N`), or `HEAD~N`.

- `slay tasks assets write <assetId> [--mutate-version]` — `--mutate-version` swaps the latest version's content_hash in place; default creates a new version row.
- `slay tasks assets append <assetId> [--mutate-version]` — same flag semantics; useful for log-style appends to keep history flat.

- `slay tasks assets versions list <assetId> [--limit <n>] [--offset <n>] [--json]` — list versions, newest first.
- `slay tasks assets versions read <assetId> <version>` — print content of a specific version to stdout.
- `slay tasks assets versions diff <assetId> <a> [b] [--no-color] [--json]` — unified diff between two versions; `b` defaults to latest. Colorized output unless piped or `--no-color`.
- `slay tasks assets versions create <assetId> [--name <name>] [--json]` — create a new version from the current working copy. Honors unchanged content (always creates a row). Names are unique per asset; reserved: `HEAD`, `latest`, pure numerics.
- `slay tasks assets versions rename <assetId> <version> [newName] [--clear] [--json]` — set, change, or clear (with `--clear`) a version's name. Named versions cannot be mutated.
- `slay tasks assets versions prune <assetId> [--keep-last <n>] [--no-keep-named] [--dry-run] [--json]` — delete old versions and GC orphan blobs. Named versions are protected by default.

Restore an old version (creates a new version pointing at the old blob — non-destructive):

```bash
slay tasks assets versions read <assetId> 3 | slay tasks assets write <assetId>
```

## Piping examples

```bash
echo "Meeting notes from standup" | slay tasks assets create "standup-notes.md"
cat report.csv | slay tasks assets write <assetId>
curl -s https://example.com/data.json | slay tasks assets append <assetId>
```
