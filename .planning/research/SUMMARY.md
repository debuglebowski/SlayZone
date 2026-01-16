# Project Research Summary

**Project:** Focus (Desktop Task Management)
**Domain:** Electron + React + SQLite desktop productivity app with AI integration
**Researched:** 2026-01-17
**Confidence:** HIGH

## Executive Summary

Focus is a desktop task management app built on Electron with React frontend and SQLite persistence. The recommended stack follows modern Electron best practices: electron-vite for fast dev loops, better-sqlite3 for performant local storage, Zustand for state, dnd-kit for drag-drop, and shadcn/ui for components. Work Mode (embedded AI chat + browser tabs + living docs) is the key differentiator — no competitor offers focused workspace context.

The architecture follows strict process isolation: Main process owns database and Claude CLI spawning, renderer handles UI via contextBridge-exposed API. Security is non-negotiable — nodeIntegration must stay false, contextIsolation true. WebContentsView (not deprecated webview tag) for embedded browser in Work Mode.

Key risks: native module rebuild issues with better-sqlite3 (solve with electron-rebuild postinstall), wrong SQLite path in production (use app.getPath('userData')), webview security in Work Mode (validate URLs, strip dangerous options). These are all solvable at foundation phase if patterns established early.

## Key Findings

### Recommended Stack

Mature Electron tooling with React frontend. electron-vite chosen over electron-forge due to faster HMR and better React+TS templates (forge's Vite support still experimental).

**Core technologies:**
- **electron-vite ^5.0**: Build tooling — Vite-based, instant HMR, React+TS out of box
- **Electron ^34.x**: Runtime — Chromium 132, Node 20.18.1, WebContentsView support
- **better-sqlite3 ^12.4.1**: Database — 10-50x faster than sql.js, sync API fine in main process
- **Zustand ^5.0.10**: State — 1.1kB, no boilerplate, simpler than Redux for this scale
- **@dnd-kit/core ^6.3.1**: Drag-drop — actively maintained, RBD deprecated (April 2025)
- **MDXEditor ^3.52.3**: Markdown — WYSIWYG, Notion-like editing (bundle size acceptable for desktop)
- **shadcn/ui**: Components — not npm-installed, copies into codebase, Tailwind-based

### Expected Features

**Must have (table stakes):**
- Task CRUD, status workflow (Todo/In Progress/Done)
- Projects with kanban view, drag-drop reorder
- Subtasks, priority levels, due dates with overdue indicators
- Tags, filters (status, priority, due, tags, blocked)
- Quick task entry (keyboard shortcut)
- Basic search (full-text) — currently in future.md, should be MVP
- Markdown in descriptions

**Should have (differentiators):**
- Work Mode (AI chat + browser tabs + living docs) — unique in market
- "What Next" prioritization — simpler than Motion but transparent
- Claude Code CLI integration — developer niche
- Offline-first SQLite — Things 3 is only comparable offline competitor

**Defer (v2+):**
- Recurring tasks, natural language input, calendar view
- Reminders/notifications, time tracking
- Mobile companion, export/import

### Architecture Approach

Strict Electron process model: Main process owns system access (SQLite, Claude CLI, file system), exposes safe API via contextBridge. Renderer is pure React with no Node.js access. IPC uses async invoke/handle pattern exclusively — never sendSync.

**Major components:**
1. **Main Process** — SQLite via better-sqlite3, Claude CLI spawning, IPC handlers
2. **Preload Script** — contextBridge.exposeInMainWorld with typed API
3. **React App** — UI components (shadcn/ui), data layer (Zustand + hooks), Work Mode shell
4. **Embedded Browser** — WebContentsView or iframe for Work Mode tabs

### Critical Pitfalls

1. **Security baseline** — nodeIntegration:false, contextIsolation:true, sandbox:true from day 1. XSS becomes RCE without this.
2. **Native module rebuild** — Run electron-rebuild -f -w better-sqlite3 in postinstall. NODE_MODULE_VERSION mismatch causes launch crashes.
3. **Wrong SQLite path** — Use app.getPath('userData'), not __dirname. DB works in dev, fails in packaged app otherwise.
4. **Webview security in Work Mode** — Use will-attach-webview to validate URLs, strip nodeIntegration from loaded content.
5. **Claude CLI spawning** — shell:false always, validate IPC sender, sanitize prompts. Renderer should never spawn processes directly.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation
**Rationale:** All other phases depend on secure Electron shell and database layer. Establishes patterns that prevent critical pitfalls.
**Delivers:** Electron app skeleton with secure IPC, SQLite in correct location, typed preload API
**Addresses:** Basic app structure, security baseline
**Avoids:** Pitfalls #1 (security), #3 (native module), #4 (SQLite path), #7 (sync IPC), #8 (CJS/ESM), #9 (HashRouter)

### Phase 2: Data Layer + Task CRUD
**Rationale:** Features depend on working database. Task CRUD is foundation for all feature work.
**Delivers:** Task entity with CRUD operations, repository pattern, React data hooks
**Uses:** better-sqlite3, Zustand, React Query/SWR
**Avoids:** Pitfall #6 (IPC listener leaks)

### Phase 3: Core Task Management
**Rationale:** Table stakes features before differentiators. Users expect basic task management to work perfectly.
**Delivers:** Projects, kanban view, drag-drop, statuses, priorities, due dates, subtasks, tags, filters
**Uses:** dnd-kit, shadcn/ui
**Avoids:** Pitfall #11 (dragover), #12 (virtualization+DnD)

### Phase 4: AI Integration
**Rationale:** Can parallelize with Phase 3 after Phase 1 done. Needs separate research for Claude CLI streaming patterns.
**Delivers:** Claude CLI spawner, streaming IPC, chat UI, response rendering
**Uses:** child_process.spawn (or utilityProcess), MDXEditor for response display
**Avoids:** Pitfall #5 (CLI security), #13 (streaming UI freeze)

### Phase 5: Work Mode
**Rationale:** Depends on task context (Phase 3) and AI chat (Phase 4). The key differentiator, but needs foundation first.
**Delivers:** Focused workspace with sidebar, embedded browser tabs, living documents
**Uses:** WebContentsView or iframe, MDXEditor
**Avoids:** Pitfall #2 (webview security)

### Phase 6: "What Next" + Polish
**Rationale:** Prioritization logic needs all task data present. Polish after core works.
**Delivers:** Auto-prioritization algorithm, keyboard shortcuts, quick entry, search
**Addresses:** Differentiator features, power user expectations

### Phase 7: Distribution
**Rationale:** Last phase. Code signing/notarization blocks user adoption.
**Delivers:** Signed macOS app, Windows installer with code signing, auto-update
**Avoids:** Pitfall #10 (code signing)

### Phase Ordering Rationale

- Phase 1 before all: Security and IPC patterns must be correct from start. Retrofitting security is expensive.
- Phase 2-3 sequential: Can't build UI without data layer.
- Phase 4 parallelizable: AI integration is independent of task features after foundation.
- Phase 5 last feature: Work Mode is the differentiator but depends on task context existing.
- Phase 7 deferred: Distribution complexity (certificates, notarization) should not block feature development.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4 (AI Integration):** Claude CLI streaming patterns, error handling, cancellation. Sparse documentation.
- **Phase 5 (Work Mode):** WebContentsView positioning, communication patterns, iframe CSP handling.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** Well-documented Electron security practices.
- **Phase 2-3 (Data + Task Management):** Standard CRUD and React patterns.
- **Phase 6 ("What Next"):** Simple algorithm, no external dependencies.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Official docs, npm trends, recent 2025 comparisons |
| Features | HIGH | Competitor analysis from official sites, 2025 reviews |
| Architecture | HIGH | Official Electron docs, established patterns |
| Pitfalls | HIGH | Official security docs, verified with multiple sources |

**Overall confidence:** HIGH

### Gaps to Address

- **Claude CLI streaming:** Need to validate exact CLI flags, output format, error codes during Phase 4 research
- **WebContentsView vs iframe:** Decision depends on target sites' CSP policies — may need runtime detection
- **macOS Tahoe performance bug:** Monitor Electron releases for fix — may affect UI smoothness
- **Search implementation:** Not detailed in research — needs Phase 3 research for full-text search in SQLite

## Sources

### Primary (HIGH confidence)
- [Electron Security Docs](https://www.electronjs.org/docs/latest/tutorial/security)
- [Electron IPC Tutorial](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [WebContentsView Migration](https://www.electronjs.org/blog/migrate-to-webcontentsview)
- [electron-vite Official](https://electron-vite.org/)
- [better-sqlite3 GitHub](https://github.com/WiseLibs/better-sqlite3)
- [dnd-kit Official](https://dndkit.com/)

### Secondary (MEDIUM confidence)
- [Zustand v5 Migration](https://zustand.docs.pmnd.rs/migrations/migrating-to-v5)
- [MDXEditor Docs](https://mdxeditor.dev/)
- [Things 3 vs Todoist](https://upbase.io/blog/todoist-vs-things-3/)
- [electron-shadcn template](https://github.com/LuanRoger/electron-shadcn)

### Tertiary (LOW confidence)
- [macOS Tahoe Electron lag](https://mjtsai.com/blog/2025/09/30/electron-apps-causing-system-wide-lag-on-tahoe/) — bug may be fixed in newer Electron

---
*Research completed: 2026-01-17*
*Ready for roadmap: yes*
