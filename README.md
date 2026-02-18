<p align="center">
  <img src="packages/apps/app/build/icon.png" width="128" height="128" alt="SlayZone" />
</p>

<h1 align="center">SlayZone</h1>

<p align="center">
  <strong>Kanban with terminals. Card → Terminal → Agent.</strong>
  <br />
  Every card hides a terminal, a browser, git management, worktree, and much more. Agent management for humans.
</p>

<br />

<p align="center">
  <a href="https://github.com/debuglebowski/SlayZone/releases/latest/download/SlayZone.dmg"><img src="https://img.shields.io/badge/Download_for-macOS-000000?style=for-the-badge&logo=apple&logoColor=white" alt="Download for macOS" /></a>&nbsp;&nbsp;
  <a href="https://github.com/debuglebowski/SlayZone/releases/latest/download/SlayZone-setup.exe"><img src="https://img.shields.io/badge/Download_for-Windows-0078D4?style=for-the-badge&logo=windows&logoColor=white" alt="Download for Windows" /></a>&nbsp;&nbsp;
  <a href="https://github.com/debuglebowski/SlayZone/releases/latest/download/SlayZone.AppImage"><img src="https://img.shields.io/badge/Download_for-Linux-FCC624?style=for-the-badge&logo=linux&logoColor=black" alt="Download for Linux" /></a>
</p>

> **macOS:** On first launch, macOS will show _"SlayZone can't be opened because Apple cannot check it for malicious software."_ Right-click the app → **Open** → click **Open** again to trust it. This only happens once.

<br />

---

<br />

### &nbsp;&#x1F916;&nbsp; Integrated AI agents

Claude Code, Codex, Gemini, and more — running inside task terminals. Spin up as many as you need per task. Real PTY sessions, not sandboxed previews.

### &nbsp;&#x267B;&#xFE0F;&nbsp; Kanban board

Drag-and-drop tasks, priorities, tags, sub-tasks — all stored in local SQLite.

### &nbsp;&#x1F310;&nbsp; Embedded browser panels

Docs, PRs, and previews inside tasks — without leaving the app.

### &nbsp;&#x1F50D;&nbsp; Automatic status tracking

SlayZone watches your agents and tracks each task's status automatically — idle, working, or waiting for input.

### &nbsp;&#x1F33F;&nbsp; Git worktree per task

Isolated branches with built-in diff, conflict resolution, and commit UI. One branch per task, no more stashing half-finished work.

### &nbsp;&#x1F512;&nbsp; Fully local

Your agents run locally on your machine — SlayZone is just the interface.

<br />

---

### Known bugs

- Terminal sync works perfectly 99% of the time. Cmd+R is a current workaround for the other situations.
- Auto-status tracking only fully works for Claude Code — Codex, Cursor, and OpenCode adapters are partial
- macOS Gatekeeper blocks first launch — right-click → Open to bypass
- Large kanban boards (100+ cards) can feel sluggish during drag-and-drop

---

### Built with

Electron &middot; React &middot; SQLite &middot; node-pty &middot; xterm.js

### Get involved

SlayZone is built with SlayZone. PRs, issues, and ideas are all welcome.

```bash
git clone https://github.com/debuglebowski/SlayZone.git
cd SlayZone && pnpm install
pnpm dev
```

| Command | |
|---|---|
| `pnpm dev` | Start dev server |
| `pnpm build` | Production build |
| `pnpm typecheck` | Typecheck all packages |
| `pnpm test:e2e` | Run E2E tests (build first) |

---

<p align="center">
  <img src="assets/star-history.jpg" width="600" alt="Star History" />
</p>
