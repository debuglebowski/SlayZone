# Layout D: Dashboard Cards

Overview-first. Show summary cards for each section. Click a card to drill in.

## Global — Overview

```
Settings > Context Manager
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Providers:  (o) Claude Code  (o) Codex CLI                         │
│                                                                     │
│  ┌──────────────────────────────┐  ┌──────────────────────────────┐ │
│  │                              │  │                              │ │
│  │   Instructions          [>]  │  │   Skills               [>]  │ │
│  │                              │  │                              │ │
│  │   "This project uses         │  │   3 skills defined           │ │
│  │    React and TypeScript..."  │  │   code-review                │ │
│  │                              │  │   refactor-helper            │ │
│  │                              │  │   test-generator             │ │
│  └──────────────────────────────┘  └──────────────────────────────┘ │
│                                                                     │
│  ┌──────────────────────────────┐  ┌──────────────────────────────┐ │
│  │                              │  │                              │ │
│  │   Commands              [>]  │  │   MCP Servers           [>]  │ │
│  │                              │  │                              │ │
│  │   2 commands defined         │  │   3 enabled                  │ │
│  │   deploy                     │  │   ★ filesystem               │ │
│  │   db-migrate                 │  │   ★ github                   │ │
│  │                              │  │     postgres                 │ │
│  └──────────────────────────────┘  └──────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Global — Drilled into Skills

```
Settings > Context Manager
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  [← Back to Overview]                                      [+ New]  │
│                                                                     │
│  Skills                                                             │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  code-review                                         Jan 5    │  │
│  ├────────────────────────────────────────────────────────────────┤  │
│  │  refactor-helper                                     Jan 3    │  │
│  ├────────────────────────────────────────────────────────────────┤  │
│  │  test-generator                                     Dec 28    │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Project — Overview

```
Project Settings > Context Manager
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Providers:  (o) Claude Code  (o) Codex CLI                         │
│                                                                     │
│  ┌──────────────────────────────┐  ┌──────────────────────────────┐ │
│  │                              │  │                              │ │
│  │   Instructions          [>]  │  │   Skills               [>]  │ │
│  │                              │  │                              │ │
│  │   CLAUDE.md ✓  AGENTS.md ✓   │  │   2 skills · all synced     │ │
│  │   "This project uses..."     │  │   code-review    ✓ ✓        │ │
│  │                              │  │   local-helper   Local       │ │
│  └──────────────────────────────┘  └──────────────────────────────┘ │
│                                                                     │
│  ┌──────────────────────────────┐  ┌──────────────────────────────┐ │
│  │                              │  │                              │ │
│  │   Commands              [>]  │  │   MCP Servers           [>]  │ │
│  │                              │  │                              │ │
│  │   1 command · synced         │  │   2 enabled                  │ │
│  │   deploy           ✓ ✓      │  │   filesystem, github         │ │
│  │                              │  │                              │ │
│  └──────────────────────────────┘  └──────────────────────────────┘ │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │   Files                                                 [>]  │   │
│  │   12 context files across 3 providers                        │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ───────────────────────────────────────────────  {msg}     [Sync]  │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Idea

The default view is a dashboard showing at-a-glance status of everything. Click a card to drill into the detail view. Providers live as a persistent row above the cards.

## Pros
- Best overview — see everything at once
- Sync status visible immediately without clicking into sections
- Feels modern and spatial
- Good for "check in" usage pattern (quick glance, see if anything needs attention)

## Cons
- Requires an extra click to edit anything (drill-in)
- Back-and-forth navigation adds friction for frequent edits
- Dashboard cards need to show meaningful previews (extra data fetching)
- More complex state management (overview + detail views)
