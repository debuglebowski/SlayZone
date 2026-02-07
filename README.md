<p align="center">
  <img src="packages/apps/app/build/icon.png" width="128" height="128" alt="SlayZone" />
</p>

<h1 align="center">SlayZone</h1>

<p align="center">
  <strong>Task management for developers who ship with AI.</strong>
  <br />
  Kanban boards, integrated terminals, Claude Code & Codex — in one desktop app.
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

## Every task gets its own AI terminal

Open a task, pick Claude Code or Codex, and start working. SlayZone runs real PTY sessions — not sandboxed previews — so your AI tools behave exactly like they do in your regular terminal.

<!-- SCREENSHOT: Task detail view with terminal -->
<p align="center">
  <img src="docs/screenshots/terminal.png" width="720" alt="Task with integrated Claude Code terminal" />
</p>

<br />

## Know when Claude needs you

SlayZone detects when Claude Code is waiting for input — permission prompts, menu selections, confirmations — and surfaces it instantly. No more switching back to check.

<!-- SCREENSHOT: Attention indicator / notification panel -->
<p align="center">
  <img src="docs/screenshots/attention.png" width="720" alt="Activity detection showing Claude needs input" />
</p>

<br />

## Git worktrees, per task

Link a git worktree to any task. One branch per task, automatic isolation, merge when done. No more stashing half-finished work.

<!-- SCREENSHOT: Git panel / worktree view -->
<p align="center">
  <img src="docs/screenshots/git.png" width="720" alt="Git worktree management per task" />
</p>

<br />

## Keyboard-first

| Shortcut | Action |
|----------|--------|
| `Cmd+N` | New task |
| `Cmd+Shift+N` | Quick run — create + open |
| `Cmd+K` | Search |
| `Cmd+Shift+D` | Complete task + close |
| `Cmd+I` | Inject task context into terminal |

<br />

---

<br />

## Build from source

```bash
git clone https://github.com/AustejaJak/slayzone.git
cd slayzone
pnpm install
pnpm dev
```

Requires Node.js 20+ and pnpm 9+.

<br />

---

<p align="center">
  <sub>Built with Electron, React, SQLite, and a mass of caffeine.</sub>
</p>
