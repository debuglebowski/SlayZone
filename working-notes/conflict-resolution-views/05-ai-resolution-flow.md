# View 5: AI Resolution Flow

AI-first approach. AI analyzes all conflicts upfront, presents suggestions
per-hunk. User reviews, edits, approves or rejects each.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  AI Conflict Resolution — src/api/routes.ts                        [Dashboard]  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─ AI Analysis ────────────────────────────────────────────────────────────┐  │
│  │  Both branches add new route imports and registrations. Ours adds user   │  │
│  │  auth routes, theirs adds API middleware. No semantic conflict — both     │  │
│  │  can coexist. Import order adjusted alphabetically.                      │  │
│  │                                                                          │  │
│  │  Confidence: ████████████░░ HIGH (87%)    Model: Claude Code             │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│  ┌─ Hunk 1/3 — Imports ─────────────────────────────────────────────────────┐  │
│  │                                                                           │  │
│  │  BEFORE (conflict markers):           AI SUGGESTION:                      │  │
│  │  ┌─────────────────────────────┐      ┌────────────────────────────────┐  │  │
│  │  │ <<<<<<< ours                │      │ import { apiMiddleware }       │  │  │
│  │  │ import { userRoutes }       │      │ import { authRoutes }         │  │  │
│  │  │ import { validateToken }    │  ──▸ │ import { userRoutes }         │  │  │
│  │  │ =======                     │      │ import { validateToken }      │  │  │
│  │  │ import { apiMiddleware }    │      │                               │  │  │
│  │  │ >>>>>>> theirs              │      │ (alphabetical order)          │  │  │
│  │  └─────────────────────────────┘      └────────────────────────────────┘  │  │
│  │                                                                           │  │
│  │  AI reasoning: "Merged both import sets. Sorted alphabetically for        │  │
│  │  consistency with project convention (see .eslintrc import/order rule)."   │  │
│  │                                                                           │  │
│  │           [✓ Accept]  [✎ Edit]  [✗ Reject]  [↻ Regenerate]               │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│  ┌─ Hunk 2/3 — Route Registration ──────────────────────────────────────────┐  │
│  │                                                                           │  │
│  │  BEFORE:                              AI SUGGESTION:                      │  │
│  │  ┌─────────────────────────────┐      ┌────────────────────────────────┐  │  │
│  │  │ <<<<<<< ours                │      │   router.use('/api', api..);  │  │  │
│  │  │   router.use('/users',...); │      │   router.use('/protected',.. │  │  │
│  │  │   router.use('/protected',. │  ──▸ │   router.use('/users', ..);  │  │  │
│  │  │ =======                     │      │                               │  │  │
│  │  │   router.use('/api', ...);  │      │ (API routes first, then auth) │  │  │
│  │  │ >>>>>>> theirs              │      │                               │  │  │
│  │  └─────────────────────────────┘      └────────────────────────────────┘  │  │
│  │                                                                           │  │
│  │  AI reasoning: "API middleware should register before auth-protected      │  │
│  │  routes so /api endpoints get middleware applied first."                   │  │
│  │                                                                           │  │
│  │           [✓ Accept]  [✎ Edit]  [✗ Reject]  [↻ Regenerate]               │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│  ┌─ Hunk 3/3 — Exports ── ACCEPTED ─────────────────────────────────────────┐  │
│  │  ✓ export const AUTH_VERSION = '2.0';                                     │  │
│  │  ✓ export const API_VERSION = '1.5';                                      │  │
│  │  AI: "Both exports are independent constants. Keep both."     [Undo ↩]   │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│  ┌─ Summary ────────────────────────────────────────────────────────────────┐  │
│  │  1/3 accepted  •  2 pending review  •  [Accept All Remaining]            │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│                                                          [Mark Resolved ✓]      │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Edit Mode (after clicking [✎ Edit])

```
│  │  ┌─ Editing Hunk 1 ──────────────────────────────────────────────────┐   │
│  │  │  import { apiMiddleware } from './api';                ▲          │   │
│  │  │  import { authRoutes } from './auth';                  │ editable │   │
│  │  │  import { userRoutes } from './users';                 │          │   │
│  │  │  import { validateToken } from './middleware';          ▼          │   │
│  │  │                                                                   │   │
│  │  │              [Save ✓]  [Cancel]  [Reset to AI Suggestion]         │   │
│  │  └───────────────────────────────────────────────────────────────────┘   │
```

## Key Concepts

- **AI analysis summary** at top — overall understanding of the conflict
- **Confidence score** — helps user decide how much to trust AI
- **Per-hunk**: side-by-side (conflict markers vs AI suggestion) with reasoning
- **[Accept]** — use AI suggestion as-is
- **[Edit]** — opens editable textarea pre-filled with AI suggestion
- **[Reject]** — falls back to manual resolution (opens Three-Way view for that hunk)
- **[Regenerate]** — re-run AI with additional context/instructions
- **[Accept All Remaining]** — bulk accept for high-confidence resolutions
- Accepted hunks collapse to show result + [Undo]
