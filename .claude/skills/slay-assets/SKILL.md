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

## Piping examples

```bash
echo "Meeting notes from standup" | slay tasks assets create "standup-notes.md"
cat report.csv | slay tasks assets write <assetId>
curl -s https://example.com/data.json | slay tasks assets append <assetId>
```
