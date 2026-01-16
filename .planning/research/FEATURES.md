# Feature Landscape: Desktop Task Management

**Domain:** Desktop task management app (personal productivity)
**Researched:** 2026-01-17
**Competitors analyzed:** Things 3, Todoist, Linear, TickTick, Notion, Obsidian Tasks

---

## Table Stakes

Features users expect. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Task CRUD** | Core function | Low | Title, description, status |
| **Due dates** | Universal expectation | Low | Date picker, overdue indicators |
| **Priority levels** | All competitors have it | Low | P1-P5 or similar scale |
| **Projects/Lists** | Organization is table stakes | Low | Container for related tasks |
| **Subtasks** | Expected for complex work | Medium | Recursive depth varies by app |
| **Kanban board** | Standard view in 2025 | Medium | Drag-drop between columns |
| **List view** | Alternative to kanban | Low | Sortable table format |
| **Drag-drop reorder** | Expected interaction | Medium | Within and between columns |
| **Quick task entry** | Speed is critical | Low | Keyboard shortcut + modal |
| **Status workflow** | Basic state machine | Low | Todo/In Progress/Done minimum |
| **Search** | Find tasks fast | Medium | Full-text across all fields |
| **Filters** | View subsets of tasks | Medium | By status, priority, due, tags |
| **Cross-device sync** | Desktop implies mobile later | High | Your spec is desktop-only for MVP, defer |
| **Tags/Labels** | Flexible categorization | Low | Multi-select per task |
| **Recurring tasks** | Listed in your future.md | Medium | Daily/weekly/monthly patterns |
| **Keyboard shortcuts** | Power users expect this | Low | n=new, esc=back minimum |
| **Reminders/Notifications** | Deadline awareness | Medium | System notifications |
| **Markdown in descriptions** | Modern expectation | Low | Things 3, Notion, Obsidian all have it |

### Table Stakes Assessment

Your spec covers most table stakes well:
- Task CRUD, due dates, priorities, projects, subtasks, kanban, drag-drop, statuses, filters, tags, keyboard shortcuts, markdown

**Gaps to address:**
- Search (listed in future.md but should be MVP)
- Reminders/Notifications (not in spec)
- Recurring tasks (in future.md but competitors all have it)

---

## Differentiators

Features that set products apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Who Has It | Notes |
|---------|-------------------|------------|------------|-------|
| **Work Mode** | Deep focus workspace | High | Unique | Your differentiator. AI chat + browser tabs + living docs in task context. No competitor has this. |
| **"What Next" logic** | Eliminates decision paralysis | Medium | Motion, Trevor AI | Auto-prioritization. Your algorithm (status > priority > due > created) is simpler than Motion's 1000-parameter approach but still valuable. |
| **Context-aware AI** | Task-specific assistance | High | Motion, ClickUp, Todoist | AI with access to task details, subtasks, workspace items. Your Work Mode AI is more focused than general assistants. |
| **Claude Code integration** | Developer-first CLI | Medium | Unique | No competitor operates via terminal. Appeals to developers. |
| **Embedded browser tabs** | Reference without switching | Medium | None | Competitors link out. You embed in workspace. |
| **Living documents** | Notes tied to task lifecycle | Medium | Notion (partial) | Persistent markdown docs in task context. Notion has docs but not tied to focused work mode. |
| **Natural language input** | Fast task capture | Medium | Todoist (strong), Things 3 (weak) | "Submit report Friday" auto-parses. Not in your spec. |
| **Pomodoro timer** | Built-in focus timing | Low | TickTick, Forest | Pairs well with Work Mode. Consider adding. |
| **Habit tracking** | Beyond tasks to routines | Medium | TickTick | Out of scope unless you expand. |
| **Gamification** | Motivation via rewards | Medium | Habitica, Todoist Karma | Niche appeal. Skip unless core to vision. |
| **Calendar view** | Timeline visualization | Medium | Todoist, TickTick, Notion | Not in your spec. Consider for post-MVP. |
| **Time tracking** | Billable hours, estimates | Medium | TickTick, Linear | In your future.md. Good deferral. |
| **Eisenhower Matrix** | Alternative prioritization | Low | TickTick | 2x2 urgent/important. Alternative to kanban grouping. |
| **Offline-first** | Works without internet | High | Things 3 | Your SQLite approach enables this. Advertise it. |
| **One-time purchase** | No subscription | N/A | Things 3 | Business model differentiator. Things 3 charges $80 total. |

### Your Differentiators (Ranked by Uniqueness)

1. **Work Mode** - Most unique. No competitor has AI chat + browser + docs in focused task context.
2. **Claude Code CLI** - Developer niche. Powerful for technical users.
3. **"What Next" prioritization** - Motion/Trevor AI have similar but yours is simpler and transparent.
4. **Offline-first SQLite** - Things 3 is only comparable. Most competitors require internet.

### Differentiators to Consider Adding

| Feature | Effort | Impact | Recommendation |
|---------|--------|--------|----------------|
| Natural language input | Medium | High | Add post-MVP. Major QoL improvement. |
| Pomodoro in Work Mode | Low | Medium | Pairs naturally with focus workspace. |
| Calendar view | Medium | Medium | Post-MVP if users request. |

---

## Anti-Features

Features to explicitly NOT build. Common mistakes in this domain.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Collaboration/Team features** | Things 3 proves solo-focused can win. Team features = complexity explosion. | Stay personal. Your spec is correctly single-user. |
| **Complex recurring patterns** | Edge cases multiply. "Third Tuesday of every month except holidays" is a rabbit hole. | Simple patterns: daily, weekly, monthly, yearly. Defer RRULE complexity. |
| **Gantt charts/Dependencies** | Overengineering for personal tasks. Linear has them; you don't need them. | Keep kanban simple. Dependencies create planning overhead. |
| **Time estimates everywhere** | Burden users with guesswork. Motion auto-estimates; you shouldn't copy. | Optional time estimates only if needed for scheduling. |
| **Gamification (Karma, streaks)** | Appeals to narrow audience. Can feel patronizing. | Focus on intrinsic motivation: clarity, not points. |
| **Customizable statuses** | In your future.md. Creates complexity for marginal benefit. | Fixed workflow is opinionated and simpler. Keep it. |
| **Mobile companion (MVP)** | Splits focus. Desktop-first is your niche. | Nail desktop. Mobile is explicitly future.md. |
| **Web app** | Things 3 proves desktop-only can work. Web adds deployment complexity. | Tauri desktop is correct choice. |
| **Workspace templates** | In your future.md. Premature generalization. | Let users build organically first. |
| **Integrations overload** | Todoist has 100+. Maintenance burden is huge. | Start with 0 integrations. Add sparingly based on demand. |
| **Complex reporting/dashboards** | Analytics without action. Users want to DO tasks, not analyze them. | Simple counts in column headers suffice. |
| **Over-automated AI** | Motion's "autopilot" can feel out of control. | Your "What Next" suggests; user decides. Keep agency. |
| **Location-based reminders** | TickTick lacks this intentionally. GPS complexity isn't worth it. | Time-based reminders only. |

### Anti-Pattern Warnings

**Avoid the "Gantt-aholic" trap:** Your kanban is simple. Don't add dependencies, critical paths, or resource allocation. That's Linear/Jira territory.

**Avoid scope creep in Work Mode:** The embedded browser, AI chat, and living docs are enough. Don't add code editors, terminal, video calls, etc.

**Avoid WIP limit ignorance:** Your kanban should probably limit "In Progress" to 1-3 tasks. Prevent users from starting everything.

---

## Feature Dependencies

```
Core (must exist first):
  Task CRUD
    └── Subtasks (requires parent task)
    └── Status workflow
        └── Kanban board (requires statuses)
            └── Drag-drop (requires kanban)
    └── Projects
        └── Project-scoped filters
    └── Priority
        └── "What Next" logic (requires priority + status + due)

Work Mode (builds on core):
  Task Detail page
    └── Work Mode button
        └── Workspace sidebar
            └── AI Chat (requires task context)
            └── Browser tabs (independent)
            └── Living documents (independent)

Search & Filters:
  Tags
    └── Tag-based filters
  Filters
    └── Saved filter states per project
```

---

## MVP Recommendation

Based on competitive analysis, prioritize for MVP:

### Must Have (Table Stakes)
1. Task CRUD with status workflow
2. Projects with kanban view
3. Subtasks
4. Priority levels
5. Due dates with overdue indicators
6. Tags
7. Filters (status, priority, due, tags, blocked)
8. Drag-drop between columns
9. Quick task entry (keyboard shortcut)
10. Basic search (full-text)

### Should Have (Differentiators)
1. "What Next" prioritization
2. Work Mode (AI chat, browser tabs, living docs)
3. Claude Code CLI integration

### Defer to Post-MVP
- Recurring tasks (medium effort, not launch-critical)
- Natural language input (medium effort, polish feature)
- Calendar view (medium effort, alternative visualization)
- Reminders/notifications (medium effort, OS integration)
- Time tracking (in future.md)
- Mobile companion (in future.md)
- Export/import (in future.md)

---

## Competitive Positioning Matrix

| Feature | Focus (You) | Things 3 | Todoist | Linear | TickTick | Notion |
|---------|-------------|----------|---------|--------|----------|--------|
| Kanban | Yes | No | Yes | Yes | Yes | Yes |
| Subtasks | Yes | Checklists | Yes | Yes | Yes | Yes |
| AI Assistant | Work Mode | No | Basic | Agents | No | Yes |
| CLI Access | Yes | No | No | No | No | No |
| Focus/Work Mode | Yes (unique) | No | No | No | Pomodoro | No |
| Offline-first | Yes | Yes | No | No | Partial | No |
| Team features | No | No | Yes | Yes | Limited | Yes |
| Pricing | TBD | $80 one-time | Freemium | Per-seat | Freemium | Freemium |
| Platform | Desktop | Apple only | All | All | All | All |

---

## Sources

### Competitor Features
- [Things 3 vs Todoist comparison](https://upbase.io/blog/todoist-vs-things-3/)
- [Things 3 Review 2025](https://productivewithchris.com/tools/things-3/)
- [Todoist Features](https://www.todoist.com/features)
- [Todoist Review 2025](https://upbase.io/blog/todoist-review/)
- [Linear Features](https://linear.app/features)
- [Linear Review 2025](https://www.siit.io/tools/trending/linear-app-review)
- [TickTick vs Todoist](https://zapier.com/blog/ticktick-vs-todoist/)
- [Notion Task Management](https://www.notion.com/help/guides/getting-started-with-projects-and-tasks)
- [Obsidian Tasks Plugin](https://github.com/obsidian-tasks-group/obsidian-tasks)

### Essential Features Research
- [Essential Features of Task Management Software 2025](https://www.zoho.com/projects/task-management/essential-features.html)
- [7 Must-Have Features in Task Management Tools 2025](https://futuramo.com/blog/what-makes-a-great-task-management-tool-7-must-have-features-in-2025/)
- [Best Task Management Apps 2025](https://www.techradar.com/best/best-task-management-apps-of-year)

### AI & Focus Mode Research
- [Top AI Task Prioritization Tools 2025](https://www.agilegrowthlabs.com/blog/top-7-ai-task-prioritization-tools-2025/)
- [AI Task Managers 2025](https://monday.com/blog/task-management/ai-task-manager/)
- [Motion AI Features](https://www.usemotion.com/)
- [Sunsama Focus Mode](https://max-productive.ai/ai-tools/sunsama/)
- [Asana Focus Mode](https://asana.com/inside-asana/focus-mode-is-a-new-feature-that-could-raise-your-iq)

### Anti-Patterns Research
- [Project Management Anti-Patterns](https://www.rubick.com/three-anti-patterns-for-project-management/)
- [Sprint Anti-Patterns](https://agilemania.com/anti-patterns-of-sprint-planning-task-creation)

---

**Confidence Level:** HIGH
- Competitor features verified via official sites and recent reviews
- Table stakes derived from cross-competitor analysis
- Differentiators identified through gap analysis against spec.md
