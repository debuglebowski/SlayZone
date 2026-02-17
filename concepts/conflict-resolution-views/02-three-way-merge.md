# View 2: Three-Way Merge Editor

Classic merge tool. Four panes: base (ancestor), ours, theirs, and
the editable result at the bottom.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  src/api/routes.ts — Hunk 1 of 3      [◀ Prev File] [Next File ▸] [Dashboard]  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─ BASE (common ancestor) ──────────────────────────────────────────────┐     │
│  │  14 │ import { Router } from 'express';                               │     │
│  │  15 │ import { authRoutes } from './auth';                            │     │
│  │  16 │                                                                 │     │
│  │  17 │ export function createRouter() {                                │     │
│  │  18 │   const router = Router();                                      │     │
│  │  19 │   router.use('/auth', authRoutes);                              │     │
│  │  20 │   return router;                                                │     │
│  │  21 │ }                                                               │     │
│  └───────────────────────────────────────────────────────────────────────┘     │
│                                                                                 │
│  ┌─ OURS (feature/auth) ─────────────┐ ┌─ THEIRS (main) ────────────────┐     │
│  │  14 │ import { Router } from ...  │ │  14 │ import { Router } from ...│     │
│  │  15 │ import { authRoutes }       │ │  15 │ import { authRoutes }     │     │
│  │+ 16 │ import { userRoutes }       │ │  16 │                           │     │
│  │  17 │                             │ │  17 │ export function create..  │     │
│  │  18 │ export function create..    │ │  18 │   const router = Router() │     │
│  │  19 │   const router = Router()   │ │  19 │   router.use('/auth', .. │     │
│  │  20 │   router.use('/auth', ..    │ │+ 20 │   router.use('/api', ..  │     │
│  │+ 21 │   router.use('/users', ..   │ │  21 │   return router;         │     │
│  │  22 │   return router;            │ │  22 │ }                        │     │
│  │  23 │ }                           │ │                                 │     │
│  │                                   │ │                                 │     │
│  │  [Accept Ours ✓]                  │ │  [Accept Theirs ✓]             │     │
│  └───────────────────────────────────┘ └─────────────────────────────────┘     │
│                                                                                 │
│  ┌─ RESULT (editable) ──────────────────────────────────────────────────┐     │
│  │  14 │ import { Router } from 'express';                     ▲        │     │
│  │  15 │ import { authRoutes } from './auth';                  │        │     │
│  │  16 │ import { userRoutes } from './users';    ← from ours  │        │     │
│  │  17 │                                                       │        │     │
│  │  18 │ export function createRouter() {                      │        │     │
│  │  19 │   const router = Router();                            │        │     │
│  │  20 │   router.use('/auth', authRoutes);                    │        │     │
│  │  21 │   router.use('/users', userRoutes);      ← from ours  │        │     │
│  │  22 │   router.use('/api', apiMiddleware);     ← from theirs│        │     │
│  │  23 │   return router;                                      ▼        │     │
│  │  24 │ }                                                              │     │
│  │                                                                      │     │
│  │  ┌──────────────────────────────────────────────────────────────┐    │     │
│  │  │ ← from ours   ← from theirs   ← manual edit   ← AI        │    │     │
│  │  └──────────────────────────────────────────────────────────────┘    │     │
│  └──────────────────────────────────────────────────────────────────────┘     │
│                                                                                 │
│  [◀ Prev Hunk]  Hunk 1/3  [Next Hunk ▸]    [AI Suggest] [Mark Resolved ✓]     │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Key Concepts

- **Base pane** (top): the common ancestor — what both branches started from
- **Ours/Theirs** (middle): side-by-side, added lines highlighted with `+`
- **Result pane** (bottom): fully editable. Lines annotated with origin
- **Origin markers**: `← from ours`, `← from theirs`, `← manual edit`, `← AI`
- **Accept buttons**: "Accept Ours" / "Accept Theirs" replace result with that side
- **Hunk navigation**: step through conflict hunks within the file
- **File navigation**: prev/next file, or back to dashboard
- **AI Suggest**: fills result pane with AI-resolved version (can then manually edit)
- **Color legend** at bottom of result pane
