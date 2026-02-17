# Layout A: Refined Tabs (Current, Polished)

Keep horizontal tabs but tighten grouping. Providers become a subtle icon-only toggle row instead of its own tab.

## Global

```
Settings > Context Manager
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  [Instructions]  [Skills]  [Commands]  [MCP Servers]     [+ New]    │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                                                                │  │
│  │  Provider sync:   (o) Claude Code    (o) Codex CLI             │  │
│  │                                                                │  │
│  ├────────────────────────────────────────────────────────────────┤  │
│  │                                                                │  │
│  │    ┌──────────────────────────────────────────────────┐        │  │
│  │    │  my-refactor-skill                  Jan 5, 3:02p │        │  │
│  │    └──────────────────────────────────────────────────┘        │  │
│  │    ┌──────────────────────────────────────────────────┐        │  │
│  │    │  code-review                        Jan 3, 1:15p │        │  │
│  │    └──────────────────────────────────────────────────┘        │  │
│  │    ┌──────────────────────────────────────────────────┐        │  │
│  │    │  test-generator                     Dec 28, 9:00a│        │  │
│  │    └──────────────────────────────────────────────────┘        │  │
│  │                                                                │  │
│  │                                                                │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Project

```
Project Settings > Context Manager
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  [Instructions] [Skills] [Commands] [MCP] | [Files]  [+ New] [+ G] │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                                                                │  │
│  │  Sync to:  (o) Claude Code   (o) Codex CLI                    │  │
│  │                                                                │  │
│  ├────────────────────────────────────────────────────────────────┤  │
│  │                                                                │  │
│  │    ┌──────────────────────────────────────────────────┐        │  │
│  │    │  my-skill                      CLAUDE ✓  CODEX ✓ │        │  │
│  │    └──────────────────────────────────────────────────┘        │  │
│  │    ┌──────────────────────────────────────────────────┐        │  │
│  │    │  local-helper                            [Local] │        │  │
│  │    └──────────────────────────────────────────────────┘        │  │
│  │                                                                │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ─────────────────────────────────────────────────────  Sync [btn]  │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Idea

Providers move from a separate tab to an always-visible row at the top of the content area. This removes one tab and makes the provider context always clear. The tab bar is purely for content types.

## Pros
- Minimal change from current
- Providers always visible = less confusion about what syncs where
- Clean, familiar tab pattern

## Cons
- Provider row eats vertical space on every tab
- Still many tabs for project scope (5 + actions)
- No visual hierarchy between content types
