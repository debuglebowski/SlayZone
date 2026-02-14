# Layout F: Hybrid (Tabs + Inline Provider Bar)

Two tabs only: "Content" and "MCP Servers". Content tab shows Instructions + Skills + Commands stacked with section headers. Providers is a persistent bar. Files is a button that opens the tree overlay.

## Global

```
Settings > Context Manager
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Providers:  (o) Claude Code  (o) Codex CLI                         │
│                                                                     │
│  [Content]  [MCP Servers]                                           │
│                                                                     │
│  INSTRUCTIONS                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ Global instructions that apply across all projects.            │  │
│  │ These are stored centrally.                                    │  │
│  │                                                                │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  SKILLS                                                    [+ New]  │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  code-review                                          Jan 5    │  │
│  │  refactor-helper                                      Jan 3    │  │
│  │  test-generator                                      Dec 28    │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  COMMANDS                                                  [+ New]  │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  deploy                                               Jan 2    │  │
│  │  db-migrate                                          Dec 30    │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Project

```
Project Settings > Context Manager
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Providers:  (o) Claude Code  (o) Codex CLI            [Files ↗]   │
│                                                                     │
│  [Content]  [MCP Servers]                                           │
│                                                                     │
│  INSTRUCTIONS                               CLAUDE.md ✓  AGENTS ✓  │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ This is a React project using TypeScript and Electron.         │  │
│  │ Follow existing patterns. Use pnpm for package management.     │  │
│  │                                                                │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  SKILLS                                         [+ New]  [+ Global] │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  code-review                            CLAUDE ✓  CODEX ✓      │  │
│  │  local-helper                                       [Local]    │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  COMMANDS                                       [+ New]  [+ Global] │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  deploy                                 CLAUDE ✓  CODEX ✓      │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ───────────────────────────────────────────────  {msg}     [Sync]  │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Idea

Collapse Instructions, Skills, and Commands into one "Content" tab as stacked sections with section headers. Only 2 tabs total. Files becomes a small button/link that opens the file tree (since it's a power-user feature). Providers is always visible as a compact bar at the top.

## Pros
- Only 2 tabs — dead simple navigation
- All content visible at once without switching tabs
- Section headers with inline actions ([+ New]) feel natural
- Provider bar always visible
- Files demoted to a link (it's advanced anyway)

## Cons
- Long scrollable page when there are many items
- Editing a skill inline pushes commands section down
- MCP servers grid is separate — switching between content and MCP is the only tab switch
- Less "clean" than pure tabs — the stacked sections can feel cluttered with many items
