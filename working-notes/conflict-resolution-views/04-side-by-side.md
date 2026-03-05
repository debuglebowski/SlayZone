# View 4: Side-by-Side Diff

Two-pane comparison with sync scrolling. Conflict regions highlighted.
Right pane is editable (the result).

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  src/api/routes.ts        [Three-Way] [Inline] [Side-by-Side ●]  [Dashboard]   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─ OURS (feature/auth) ──────────────┐ ┌─ THEIRS (main) — editable ─────────┐│
│  │                                     │ │                                     ││
│  │  12 │ import { Router }             │ │  12 │ import { Router }             ││
│  │  13 │ import { authRoutes }         │ │  13 │ import { authRoutes }         ││
│  │ ╔══════════════════════════════════╗│ │ ╔══════════════════════════════════╗││
│  │ ║+ 14 │ import { userRoutes }      ║│ │ ║                                 ║││
│  │ ║+ 15 │ import { validateToken }   ║│ │ ║+ 14 │ import { apiMiddleware }  ║││
│  │ ║                                  ║│ │ ║                                  ║││
│  │ ║   [Accept ▸]                     ║│ │ ║   [◀ Accept]                     ║││
│  │ ╚══════════════════════════════════╝│ │ ╚══════════════════════════════════╝││
│  │  16 │                               │ │  15 │                               ││
│  │  17 │ export function create...     │ │  16 │ export function create...     ││
│  │  18 │   const router = Router()     │ │  17 │   const router = Router()     ││
│  │  19 │   router.use('/auth', ...     │ │  18 │   router.use('/auth', ...     ││
│  │ ╔══════════════════════════════════╗│ │ ╔══════════════════════════════════╗││
│  │ ║+ 20 │   router.use('/users',...  ║│ │ ║                                 ║││
│  │ ║+ 21 │   router.use('/protected' ║│ │ ║+ 19 │   router.use('/api', ..   ║││
│  │ ║                                  ║│ │ ║                                  ║││
│  │ ║   [Accept ▸]                     ║│ │ ║   [◀ Accept]                     ║││
│  │ ╚══════════════════════════════════╝│ │ ╚══════════════════════════════════╝││
│  │  22 │   return router;              │ │  20 │   return router;              ││
│  │  23 │ }                             │ │  21 │ }                             ││
│  │ ╔══════════════════════════════════╗│ │ ╔══════════════════════════════════╗││
│  │ ║+ 24 │ export const AUTH = '2.0' ║│ │ ║+ 22 │ export const API = '1.5'  ║││
│  │ ║                                  ║│ │ ║                                  ║││
│  │ ║   [Accept ▸]                     ║│ │ ║   [◀ Accept]                     ║││
│  │ ╚══════════════════════════════════╝│ │ ╚══════════════════════════════════╝││
│  │                                     │ │                                     ││
│  └─────────────────────────────────────┘ └─────────────────────────────────────┘│
│                                                                                 │
│  ── Minimap ────────────────────────────────────────────────────────────────── │
│  │░░░░░██░░░░░░░░██░░░░░░░░░░░░░░██░░░│  3 conflicts  •  ██ = conflict region │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                 │
│  Conflict 1/3   [◀ Prev] [Next ▸]    [Accept All Ours] [Accept All Theirs]     │
│                                       [AI Resolve All]  [Mark Resolved ✓]       │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## After Accepting Ours on Conflict 1

```
│  │ ╔═ RESOLVED ══════════════════════╗│ │ ╔═ RESOLVED ══════════════════════╗││
│  │ ║  14 │ import { userRoutes }     ║│ │ ║  14 │ import { userRoutes }     ║││
│  │ ║  15 │ import { validateToken }  ║│ │ ║  15 │ import { validateToken }  ║││
│  │ ║                        [Undo ↩] ║│ │ ║                                 ║││
│  │ ╚════════════════════════════════╝│ │ ╚═════════════════════════════════╝││
```

## Key Concepts

- **Sync-scrolled** panes — same logical line always aligned
- **Conflict regions** boxed with `╔══╗` double-border
- **[Accept ▸]** / **[◀ Accept]** arrows point toward which side is being accepted
- **Minimap** at bottom shows file overview with conflict positions (like VS Code)
- **Right pane editable** — can manually type in the result
- **Resolved regions** change to green border, show final text on both sides
- Non-conflicting lines shown normally with matching line numbers
- **Blank lines** pad shorter side to keep alignment
