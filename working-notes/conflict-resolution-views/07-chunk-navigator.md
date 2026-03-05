# View 7: Chunk Navigator

Focused, hunk-by-hunk walkthrough within a single file. One conflict
at a time, full screen. Optimized for keyboard-driven resolution.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  src/api/routes.ts                         Chunk 2 of 3    [Dashboard] [×]      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─ Context (above) ────────────────────────────────────────────────────────┐  │
│  │  16 │                                                                    │  │
│  │  17 │ export function createRouter() {                                   │  │
│  │  18 │   const router = Router();                                         │  │
│  │  19 │   router.use('/auth', authRoutes);                                 │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│  ┌─ ◀◀ feature/auth ─────────────────────────────────────────────────────── │  │
│  │                                                                          │  │
│  │     router.use('/users', userRoutes);                                    │  │
│  │     router.use('/protected', validateToken, protectedRoutes);            │  │
│  │                                                                          │  │
│  ├─ ▸▸ main ────────────────────────────────────────────────────────────── │  │
│  │                                                                          │  │
│  │     router.use('/api', apiMiddleware);                                   │  │
│  │                                                                          │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│  ┌─ Context (below) ────────────────────────────────────────────────────────┐  │
│  │  20 │   return router;                                                   │  │
│  │  21 │ }                                                                  │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│  ┌─ Result ─────────────────────────────────────────────────────────────────┐  │
│  │     router.use('/api', apiMiddleware);                          ▲        │  │
│  │     router.use('/users', userRoutes);                          │ edit   │  │
│  │     router.use('/protected', validateToken, protectedRoutes);  ▼        │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│  ─── Keyboard ──────────────────────────────────────────────────────────────── │
│  │  [1] Ours   [2] Theirs   [3] Both   [A] AI   [E] Edit   [Enter] Accept  │ │
│  │  [←] Prev chunk                               [→] Next chunk             │ │
│  │  [R] Regenerate AI       [U] Undo              [D] Done (mark resolved)  │ │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                 │
│  ┌─ File Progress ──────────────────────────────────────────────────────────┐  │
│  │  ✓ Chunk 1 (imports)     ◉ Chunk 2 (routes)     ○ Chunk 3 (exports)     │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Key Concepts

- **One chunk at a time** — no overwhelm, laser focus
- **Context lines** above/below show surrounding code (non-conflicting)
- **Both sides** stacked vertically (not side-by-side) to maximize width
- **Result pane** at bottom — pre-filled based on last action, always editable
- **Full keyboard control** — numbers for quick actions, arrows for navigation
  - `1` = accept ours, `2` = accept theirs, `3` = both sides
  - `A` = AI suggest, `E` = focus editor, `Enter` = confirm and advance
  - `←` / `→` = navigate chunks, `D` = done with file
- **File progress** bar at bottom — see chunk status at a glance
- Great for **vim-style users** who prefer keyboard over mouse
