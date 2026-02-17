# Layout C: Two-Panel Master-Detail

Everything in one view. Left panel shows a unified list of all items (instructions, skills, commands). Right panel shows the editor. MCP and Providers are tabs above the list.

## Global

```
Settings > Context Manager
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  [Content]  [MCP Servers]  [Providers]                     [+ New]  │
│                                                                     │
│  ┌─────────────────────────┬───────────────────────────────────┐    │
│  │                         │                                   │    │
│  │  INSTRUCTIONS           │  code-review                      │    │
│  │  ┌───────────────────┐  │                                   │    │
│  │  │ Root instructions │  │  Filename: [code-review        ]  │    │
│  │  └───────────────────┘  │                                   │    │
│  │                         │  Content:                         │    │
│  │  SKILLS                 │  ┌─────────────────────────────┐  │    │
│  │  ┌───────────────────┐  │  │ ---                         │  │    │
│  │  │ code-review     ● │  │  │ description: Reviews code   │  │    │
│  │  ├───────────────────┤  │  │ trigger: auto               │  │    │
│  │  │ refactor-helper   │  │  │ ---                         │  │    │
│  │  ├───────────────────┤  │  │                             │  │    │
│  │  │ test-generator    │  │  │ Review the code for...      │  │    │
│  │  └───────────────────┘  │  │                             │  │    │
│  │                         │  └─────────────────────────────┘  │    │
│  │  COMMANDS               │                                   │    │
│  │  ┌───────────────────┐  │  Autosave on blur                │    │
│  │  │ deploy            │  │                        [Delete]   │    │
│  │  ├───────────────────┤  │                                   │    │
│  │  │ db-migrate        │  │                                   │    │
│  │  └───────────────────┘  │                                   │    │
│  │                         │                                   │    │
│  └─────────────────────────┴───────────────────────────────────┘    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Project

```
Project Settings > Context Manager
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  [Content]  [MCP Servers]  [Files]                [+ New]  [+ Glb]  │
│                                                                     │
│  ┌─────────────────────────┬───────────────────────────────────┐    │
│  │                         │                                   │    │
│  │  INSTRUCTIONS           │  Root Instructions                │    │
│  │  ┌───────────────────┐  │                                   │    │
│  │  │ Root instructions │  │  ┌─────────────────────────────┐  │    │
│  │  └───────────────────┘  │  │                             │  │    │
│  │                         │  │ This is a React project     │  │    │
│  │  SKILLS                 │  │ using TypeScript and...     │  │    │
│  │  ┌───────────────────┐  │  │                             │  │    │
│  │  │ review   CLAUDE ✓ │  │  └─────────────────────────────┘  │    │
│  │  ├───────────────────┤  │                                   │    │
│  │  │ local-sk  [Local] │  │  Sync: CLAUDE.md ✓  AGENTS.md ✓  │    │
│  │  └───────────────────┘  │                                   │    │
│  │                         │  Providers:                       │    │
│  │  COMMANDS               │  (o) Claude Code  (o) Codex CLI   │    │
│  │  ┌───────────────────┐  │                                   │    │
│  │  │ deploy            │  │                                   │    │
│  │  └───────────────────┘  │                                   │    │
│  │                         │                                   │    │
│  └─────────────────────────┴───────────────────────────────────┘    │
│                                                                     │
│  ───────────────────────────────────────────────  {msg}     [Sync]  │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Idea

Merge Instructions, Skills, and Commands into a single "Content" view with a master-detail split. Left shows grouped items, right shows the editor for the selected item. MCP and Files get their own top tabs since they have very different UI patterns.

## Pros
- All content visible at once — no switching between Skills and Commands tabs
- Persistent list while editing — easy to jump between items
- Feels like a proper content management tool
- Reduces tab count to 2-3

## Cons
- Master-detail requires enough horizontal space
- Root instructions don't fit the "list item" pattern as well
- More complex to implement (grouped list, selection state, split pane)
