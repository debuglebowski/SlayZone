// SlayZone-side claims used across all comparison pages.
// Stable across competitors. Per-competitor differences (e.g. weaknesses
// relative to specific competitor) live in `editorial.slayzone_weaknesses`
// in each competitor's canon frontmatter.

export const slayzoneClaims = {
  about_kicker: 'About SlayZone',
  about_heading: 'Task-first agent orchestration',
  what:
    'Desktop kanban for AI coding agents. Every card hides a terminal, browser, git worktree, and code editor. Task-first orchestration — the board is the control surface, and each task owns its own isolated workspace.',
  strengths: [
    'Kanban board is primary UX — task visibility, status flow, drag-and-drop, subtasks, dependencies.',
    'Fully local-first: no login, no cloud sync, no mandatory account. SQLite on your machine.',
    'Per-task isolation: each card owns its own terminal sessions, browser pane, worktree, and editor.',
    'CLI companion (`slay`) mirrors task and browser workflows from any shell.',
    'Issue sync with Linear, GitHub Issues, and Jira for teams that plan externally.',
  ],
  pricing_summary: 'Free and open source. No account required.',
  hero_caption:
    'SlayZone — kanban board with per-task terminals, browser, and worktree isolation.',
  hero_alt:
    'SlayZone homepage — kanban with terminals, card to terminal to agent workflow.',
}
