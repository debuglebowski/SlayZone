# View 3: Inline Unified View

Single-pane view. Conflict regions shown inline with clear markers.
Best for small/simple conflicts where context matters more than comparison.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  src/api/routes.ts — 3 conflicts       [Three-Way] [Inline ●] [Side-by-Side]   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  12 │ import { Router } from 'express';                                         │
│  13 │ import { authRoutes } from './auth';                                      │
│     │                                                                           │
│     │ ┌─── CONFLICT 1 of 3 ──────────────── [Ours] [Theirs] [Both] [AI] ──┐   │
│     │ │                                                                     │   │
│     │ │  ◀◀ OURS (feature/auth) ─────────────────────────────────────────  │   │
│     │ │  + import { userRoutes } from './users';                            │   │
│     │ │  + import { validateToken } from './middleware';                     │   │
│     │ │                                                                     │   │
│     │ │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │   │
│     │ │                                                                     │   │
│     │ │  ▸▸ THEIRS (main) ───────────────────────────────────────────────  │   │
│     │ │  + import { apiMiddleware } from './api';                            │   │
│     │ │                                                                     │   │
│     │ └─────────────────────────────────────────────────────────────────────┘   │
│     │                                                                           │
│  14 │                                                                           │
│  15 │ export function createRouter() {                                          │
│  16 │   const router = Router();                                                │
│  17 │   router.use('/auth', authRoutes);                                        │
│     │                                                                           │
│     │ ┌─── CONFLICT 2 of 3 ──────────────── [Ours] [Theirs] [Both] [AI] ──┐   │
│     │ │                                                                     │   │
│     │ │  ◀◀ OURS ────────────────────────────────────────────────────────  │   │
│     │ │  +   router.use('/users', userRoutes);                              │   │
│     │ │  +   router.use('/protected', validateToken, protectedRoutes);      │   │
│     │ │                                                                     │   │
│     │ │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │   │
│     │ │                                                                     │   │
│     │ │  ▸▸ THEIRS ──────────────────────────────────────────────────────  │   │
│     │ │  +   router.use('/api', apiMiddleware);                             │   │
│     │ │                                                                     │   │
│     │ └─────────────────────────────────────────────────────────────────────┘   │
│     │                                                                           │
│  18 │   return router;                                                          │
│  19 │ }                                                                         │
│     │                                                                           │
│     │ ┌─── CONFLICT 3 of 3 ──────────────── [Ours] [Theirs] [Both] [AI] ──┐   │
│     │ │                                                                     │   │
│     │ │  ◀◀ OURS ────────────────────────────────────────────────────────  │   │
│     │ │  + export const AUTH_VERSION = '2.0';                               │   │
│     │ │                                                                     │   │
│     │ │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │   │
│     │ │                                                                     │   │
│     │ │  ▸▸ THEIRS ──────────────────────────────────────────────────────  │   │
│     │ │  + export const API_VERSION = '1.5';                                │   │
│     │ │                                                                     │   │
│     │ └─────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ─────────────────────────────────────────────────────────────────────────────  │
│  Conflict 1/3        [◀ Prev] [Next ▸]    [AI Resolve All]  [Mark Resolved ✓]  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Resolved State (after clicking [Both] on Conflict 1)

```
│     │ ┌─── CONFLICT 1 of 3 ── RESOLVED (both) ─────────────────────────────┐  │
│     │ │  ✓ import { userRoutes } from './users';                            │  │
│     │ │  ✓ import { validateToken } from './middleware';                     │  │
│     │ │  ✓ import { apiMiddleware } from './api';                           │  │
│     │ │                                                          [Undo ↩]   │  │
│     │ └─────────────────────────────────────────────────────────────────────┘  │
```

## Key Concepts

- **Full file context** visible — conflicts are inline "cards" within the file
- **Per-conflict actions**: [Ours] [Theirs] [Both] [AI] — one click to resolve
- **[Both]** keeps both sides (common for imports, exports, config entries)
- **Resolved conflicts** collapse to show final result with [Undo] option
- **View switcher** tabs at top: toggle between Three-Way / Inline / Side-by-Side
- **Conflict counter** and navigation at bottom
- Scrolling through file shows non-conflicting code as normal context
