# Layout G: Minimal Tabs (3 Only)

Three tabs: Content, MCP, Providers. Content shows instructions + skills + commands grouped. Clean and simple.

## Global

```
Settings > Context Manager
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  ┌───────────┬─────────────────┬────────────┐                       │
│  │  Content  │  MCP Servers    │  Providers │                       │
│  └───────────┴─────────────────┴────────────┘                       │
│                                                                     │
│  Instructions                                                       │
│  ─────────────────────────────────────────────                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ Global instructions content here...                            │  │
│  │                                                                │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                     │
│                                                                     │
│  Skills                                                    [+ New]  │
│  ─────────────────────────────────────────────                      │
│    code-review                                             Jan 5    │
│    refactor-helper                                         Jan 3    │
│    test-generator                                         Dec 28    │
│                                                                     │
│                                                                     │
│  Commands                                                  [+ New]  │
│  ─────────────────────────────────────────────                      │
│    deploy                                                  Jan 2    │
│    db-migrate                                             Dec 30    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Project

```
Project Settings > Context Manager
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  ┌───────────┬─────────────────┬────────────┬────────┐              │
│  │  Content  │  MCP Servers    │  Providers │  Files │              │
│  └───────────┴─────────────────┴────────────┴────────┘              │
│                                                                     │
│  Instructions                              CLAUDE.md ✓   AGENTS ✓  │
│  ─────────────────────────────────────────────                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ This project uses React and TypeScript.                        │  │
│  │ Follow existing patterns.                                      │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                     │
│                                                                     │
│  Skills                                         [+ New]  [+ Global] │
│  ─────────────────────────────────────────────                      │
│    code-review                           CLAUDE ✓  CODEX ✓          │
│    local-helper                                    [Local]          │
│                                                                     │
│                                                                     │
│  Commands                                       [+ New]  [+ Global] │
│  ─────────────────────────────────────────────                      │
│    deploy                                CLAUDE ✓  CODEX ✓          │
│                                                                     │
│                                                                     │
│  ───────────────────────────────────────────────  {msg}     [Sync]  │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Idea

Like Layout F but even simpler. Three clean tabs — Content, MCP, Providers. The Content tab stacks all three content types with thin section dividers and inline action buttons. No boxes or borders around the sections — just divider lines and whitespace.

The key difference from F: Providers gets its own tab (not a persistent bar), and the visual treatment is lighter — section headers with divider lines instead of bordered panels.

## Pros
- Only 3-4 tabs — very clean tab bar
- All content types visible together — no switching for the common case
- Light visual treatment — doesn't feel heavy
- Clear mental model: "Content" = what I tell AI, "MCP" = tools, "Providers" = where it goes
- Room for each section to breathe

## Cons
- Still a scrollable page for Content tab
- Providers hidden behind a tab (less visible than persistent bar)
- Section dividers can feel like a less structured layout
- Inline editing still pushes content below down
