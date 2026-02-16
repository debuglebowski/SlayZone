# Context Manager Redesign — v4

Keep the current context manager (source of truth editor) on the left.
Add a static file tree on the right showing what's on disk + sync status.
Per-item sync buttons. Sync All at the top.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌─ Source of Truth (current CM) ────┐  ┌─ Synced Files ───── Sync All ──┐ │
│  │                                    │  │                                │ │
│  │  ┌────────────┐ ┌──────────────┐  │  │  CLAUDE.md              ✓  ↻  │ │
│  │  │ Providers  │ │ Instructions │  │  │  AGENTS.md              ✓  ↻  │ │
│  │  │ 3 enabled  │ │ 42 lines     │  │  │  .cursorrules           ✓  ↻  │ │
│  │  └────────────┘ └──────────────┘  │  │                                │ │
│  │  ┌────────────┐ ┌──────────────┐  │  │  .claude/                      │ │
│  │  │ Skills     │ │ Commands     │  │  │    skills/                     │ │
│  │  │ 4 items    │ │ 1 item       │  │  │      api-patterns.md   ✓  ↻  │ │
│  │  └────────────┘ └──────────────┘  │  │      coding-stds.md    ✓  ↻  │ │
│  │  ┌────────────┐                   │  │      testing-guide.md  ⚠  ↻  │ │
│  │  │ MCP        │                   │  │    commands/                    │ │
│  │  │ 2 servers  │                   │  │      deploy-script.md  ✓  ↻  │ │
│  │  └────────────┘                   │  │                                │ │
│  │                                    │  │  .agents/                      │ │
│  │  Click a card to edit that         │  │    skills/                     │ │
│  │  section (instructions, skills,    │  │      api-patterns.md   ✓  ↻  │ │
│  │  commands, etc.)                   │  │                                │ │
│  │                                    │  │  .cursorrules           ✓  ↻  │ │
│  │                                    │  │                                │ │
│  └────────────────────────────────────┘  │  ┄ Global ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄  │ │
│                                          │  ~/.claude/CLAUDE.md    ✓  ↻  │ │
│                                          │  ~/.claude/skills/            │ │
│                                          │    coding-standards.md ✓  ↻  │ │
│                                          │                                │ │
│                                          └────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

  ✓ = in sync    ⚠ = changed (global updated)    ↻ = sync this file
```

Left side: the existing ContextManagerSettings (overview cards, drill-in editing).
Right side: read-only file tree showing every file on disk, grouped by provider
directory, with per-file sync status + individual sync button.
