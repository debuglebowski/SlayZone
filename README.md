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

<!-- HERO SCREENSHOT: Replace with actual screenshot -->
<p align="center">
  <img src="docs/screenshots/hero.png" width="720" alt="SlayZone — Kanban board with integrated AI terminal" />
</p>

<p align="center">
  <a href="#"><img src="https://img.shields.io/badge/Download_for-macOS-000000?style=for-the-badge&logo=apple&logoColor=white" alt="Download for macOS" /></a>&nbsp;&nbsp;
  <a href="#"><img src="https://img.shields.io/badge/Download_for-Windows-0078D4?style=for-the-badge&logo=windows&logoColor=white" alt="Download for Windows" /></a>&nbsp;&nbsp;
  <a href="#"><img src="https://img.shields.io/badge/Download_for-Linux-FCC624?style=for-the-badge&logo=linux&logoColor=black" alt="Download for Linux" /></a>
</p>

<br />

---

<br />

## Run any number of agents per task

Each task contains one or more integrated terminals. Spin up Claude Code, Codex, or a plain shell — run as many as you need. One agent researching, one coding, one testing, all inside the same task. Real PTY sessions, not sandboxed previews.

<!-- SCREENSHOT: Task detail view with terminal -->
<p align="center">
  <img src="docs/screenshots/terminal.png" width="720" alt="Task with multiple AI agent terminals" />
</p>

<br />

## Automatic status tracking

SlayZone watches your agents and tracks each task's status automatically — idle, working, or waiting for your input. No more switching between terminals to check what's happening.

<!-- SCREENSHOT: Attention indicator / notification panel -->
<p align="center">
  <img src="docs/screenshots/attention.png" width="720" alt="Automatic agent status tracking" />
</p>

<br />

## Built-in browser

Each task has an inline browser with multiple tabs. Preview what your agents are building without leaving the app.

<!-- SCREENSHOT: Inline browser -->
<p align="center">
  <img src="docs/screenshots/browser.png" width="720" alt="Inline browser preview per task" />
</p>

<br />

## Git worktrees, per task

Link a git worktree to any task. One branch per task, automatic isolation, view diffs, stage changes, merge when done. No more stashing half-finished work.

<!-- SCREENSHOT: Git panel / worktree view -->
<p align="center">
  <img src="docs/screenshots/git.png" width="720" alt="Git worktree management per task" />
</p>

<br />

---

<br />

## Contributing

Contributions are welcome! Worth noting is that SlayZone is pretty much built with SlayZone itself.

SlayZone is a pnpm monorepo built with Electron, React, and SQLite.
