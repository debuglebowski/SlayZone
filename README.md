<p align="center">
  <img src="packages/apps/app/build/icon.png" width="128" height="128" alt="SlayZone" />
</p>

<h1 align="center">SlayZone</h1>

<p align="center">
  <strong>Mission control for your AI coding agents.</strong>
  <br />
  Manage all your agents from one place — scoped to tasks, tracked automatically.
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

### &nbsp;&#x1F916;&nbsp; Run any number of agents per task

Each task contains one or more integrated terminals. Spin up Claude Code, Codex, or a plain shell — run as many as you need. One agent researching, one coding, one testing, all inside the same task. Real PTY sessions, not sandboxed previews.

### &nbsp;&#x1F50D;&nbsp; Automatic status tracking

SlayZone watches your agents and tracks each task's status automatically — idle, working, or waiting for your input. No more switching between terminals to check what's happening.

### &nbsp;&#x1F310;&nbsp; Built-in browser

Each task has an inline browser with multiple tabs. Preview what your agents are building without leaving the app.

### &nbsp;&#x1F33F;&nbsp; Git worktrees, per task

Link a git worktree to any task. One branch per task, automatic isolation, view diffs, stage changes, merge when done. No more stashing half-finished work.

<br />

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
