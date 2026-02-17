# Layout E: Stacked Accordion

All sections visible on one scrollable page. Each section is collapsible. No tabs at all.

## Global

```
Settings > Context Manager
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Providers:  (o) Claude Code  (o) Codex CLI                         │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  ▼ Instructions                                                │  │
│  ├────────────────────────────────────────────────────────────────┤  │
│  │                                                                │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │ Global instructions that apply to all projects.          │  │  │
│  │  │ These get included when syncing project instructions.    │  │  │
│  │  │                                                          │  │  │
│  │  └──────────────────────────────────────────────────────────┘  │  │
│  │                                                                │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  ▼ Skills                                             [+ New]  │  │
│  ├────────────────────────────────────────────────────────────────┤  │
│  │                                                                │  │
│  │    code-review                                        Jan 5    │  │
│  │    refactor-helper                                    Jan 3    │  │
│  │    test-generator                                    Dec 28    │  │
│  │                                                                │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  ▶ Commands                                    2 commands      │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  ▶ MCP Servers                            3 enabled, 2 ★      │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Project

```
Project Settings > Context Manager
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Providers:  (o) Claude Code  (o) Codex CLI                         │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  ▼ Instructions                        CLAUDE.md ✓  AGENTS ✓  │  │
│  ├────────────────────────────────────────────────────────────────┤  │
│  │                                                                │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │ This is a React project using TypeScript.                │  │  │
│  │  │ Follow existing patterns. Use pnpm.                      │  │  │
│  │  │                                                          │  │  │
│  │  └──────────────────────────────────────────────────────────┘  │  │
│  │                                                                │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  ▼ Skills                                    [+ New]  [+ Glb]  │  │
│  ├────────────────────────────────────────────────────────────────┤  │
│  │                                                                │  │
│  │    code-review                          CLAUDE ✓  CODEX ✓      │  │
│  │    local-helper                                     [Local]    │  │
│  │                                                                │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  ▶ Commands                                    1 command       │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  ▶ MCP Servers                                 2 enabled       │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  ▶ Files                                      12 files         │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ───────────────────────────────────────────────  {msg}     [Sync]  │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Idea

No tabs. All sections are collapsible panels on one scrollable page. Collapsed sections show a summary (item count, sync status). Expand to interact. Multiple sections can be open simultaneously.

## Pros
- Everything on one page — no hidden content
- Collapsed headers show summary info (counts, status) = quick overview
- Can have multiple sections open at once
- No tab bar = more vertical space
- Very scannable

## Cons
- Long page when everything is expanded
- Scrolling required to reach lower sections
- MCP servers grid needs lots of space — awkward in a collapsible panel
- Inline editors (skills) expand the section further, pushing everything down
