# Layout B: Secondary Sidebar

Vertical navigation within the content area. Mirrors the outer settings sidebar pattern.

## Global

```
Settings
┌────────────┬──────────────────────────────────────────────────────┐
│            │  Context Manager                                     │
│  General   │                                                      │
│  Terminal  │  ┌────────────┬────────────────────────────────────┐  │
│  Integr.   │  │            │                                    │  │
│  Context ● │  │ Instruct.  │  Skills                   [+ New]  │  │
│            │  │ Skills   ● │                                    │  │
│            │  │ Commands   │  ┌────────────────────────────┐    │  │
│            │  │ MCP        │  │  my-refactor-skill    Jan 5│    │  │
│            │  │            │  ├────────────────────────────┤    │  │
│            │  │ ────────── │  │  code-review          Jan 3│    │  │
│            │  │ Providers  │  ├────────────────────────────┤    │  │
│            │  │            │  │  test-generator      Dec 28│    │  │
│            │  │            │  └────────────────────────────┘    │  │
│            │  │            │                                    │  │
│            │  │            │                                    │  │
│            │  └────────────┴────────────────────────────────────┘  │
│            │                                                      │
└────────────┴──────────────────────────────────────────────────────┘
```

## Project

```
Project Settings
┌────────────┬──────────────────────────────────────────────────────┐
│            │  Context Manager                                     │
│  General   │                                                      │
│  Terminal  │  ┌────────────┬────────────────────────────────────┐  │
│  Context ● │  │            │                                    │  │
│            │  │ Instruct.● │  Instructions              [auto]  │  │
│            │  │ Skills     │                                    │  │
│            │  │ Commands   │  ┌────────────────────────────┐    │  │
│            │  │ MCP        │  │                            │    │  │
│            │  │            │  │  # Project Instructions    │    │  │
│            │  │ ────────── │  │                            │    │  │
│            │  │ Files      │  │  This project uses React   │    │  │
│            │  │ Providers  │  │  and TypeScript...         │    │  │
│            │  │            │  │                            │    │  │
│            │  │            │  └────────────────────────────┘    │  │
│            │  │            │                                    │  │
│            │  │            │  CLAUDE.md ✓   AGENTS.md ✓        │  │
│            │  └────────────┴────────────────────────────────────┤  │
│            │              {sync msg}                     [Sync] │  │
└────────────┴──────────────────────────────────────────────────────┘
```

## Key Idea

Replace the horizontal tab bar with a small vertical sidebar (inner sidebar). This mirrors the outer settings layout, creating a familiar nested navigation pattern. Sections stack vertically with separators between groups (content vs meta).

## Pros
- Scales to many sections without crowding
- Clear visual hierarchy: outer sidebar = settings area, inner sidebar = section
- Room for section icons and descriptions
- No horizontal space pressure

## Cons
- Double sidebar (outer settings + inner) could feel heavy
- Less horizontal space for content
- Might feel like too many levels of nesting
