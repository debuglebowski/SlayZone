export type SkillMarketplaceCategory =
  | 'slayzone'
  | 'languages'
  | 'frameworks'
  | 'testing'
  | 'devops'
  | 'documentation'
  | 'workflow'
  | 'general'

export interface BuiltinSkillEntry {
  slug: string
  name: string
  description: string
  category: SkillMarketplaceCategory
  author: string
  tags: string[]
  content: string
}

export const BUILTIN_SKILLS: BuiltinSkillEntry[] = [
  {
    slug: 'slay',
    name: 'Slay CLI',
    description: 'Full command reference for the slay CLI — task lifecycle, subtasks, tags, browser panel, projects, automations, and more',
    category: 'slayzone',
    author: 'SlayZone',
    tags: ['slay', 'cli', 'tasks', 'browser', 'automations'],
    content: `---
name: slay
description: "Full command reference for the slay CLI — task lifecycle, subtasks, tags, browser panel, projects, automations, and more"
trigger: auto
---

Use the \`slay\` CLI to interact with the SlayZone task management system. The current task ID is available via \`$SLAYZONE_TASK_ID\` (set automatically in task terminals).

## Commands

### Task lifecycle
- \`slay tasks view [id]\` — show task details (defaults to current task)
- \`slay tasks update [id] --status <status> --title <title> --description <text> --priority <1-5> --due <date> --no-due\` — update task
- \`slay tasks done [id]\` — mark task complete
- \`slay tasks create <title> --project <name> [--description <text>] [--status <status>] [--due <date>] [--template <name|id>]\` — create task

### Subtasks
- \`slay tasks subtasks [id]\` — list subtasks of current task
- \`slay tasks subtask-add [parentId] <title> [--description <text>] [--status <status>]\` — add subtask

### Tags
- \`slay tasks tag [id]\` — show current tags
- \`slay tasks tag [id] --set <name1> [name2...]\` — replace all tags
- \`slay tasks tag [id] --add <name>\` — add a tag
- \`slay tasks tag [id] --remove <name>\` — remove a tag
- \`slay tags list --project <name>\` — list tags for a project
- \`slay tags create <name> --project <name> [--color <hex>]\` — create a tag
- \`slay tags delete <id>\` — delete a tag

### Templates
- \`slay templates list --project <name>\` — list task templates
- \`slay templates view <id>\` — view template details
- \`slay templates create <name> --project <name> [--terminal-mode <mode>] [--priority <1-5>] [--status <s>] [--default]\` — create template
- \`slay templates update <id> [--name <n>] [--terminal-mode <m>] [--priority <1-5>] [--default] [--no-default]\` — update template
- \`slay templates delete <id>\` — delete template

### Browser panel
- \`slay tasks browser navigate <url>\` — open URL in task browser panel
- \`slay tasks browser url\` — get current URL
- \`slay tasks browser screenshot [-o <path>]\` — capture screenshot
- \`slay tasks browser content [--json]\` — get page text and interactive elements
- \`slay tasks browser click <selector>\` — click element
- \`slay tasks browser type <selector> <text>\` — type into input
- \`slay tasks browser eval <code>\` — execute JS in browser

### Projects
- \`slay projects list [--json]\` — list projects
- \`slay projects create <name> [--path <path>] [--color <hex>]\` — create project
- \`slay projects update <name|id> [--name <n>] [--color <hex>] [--path <path>]\` — update project

### Automations
- \`slay automations list --project <name> [--json]\` — list automations
- \`slay automations view <id> [--json]\` — view automation details
- \`slay automations create <name> --project <name> --trigger <type> --action-command <cmd> [--cron <expr>]\` — create automation
- \`slay automations update <id> [--name <n>] [--enabled] [--disabled] [--action-command <cmd>]\` — update
- \`slay automations delete <id>\` — delete automation
- \`slay automations toggle <id>\` — enable/disable automation
- \`slay automations run <id>\` — manually trigger (requires app running)
- \`slay automations runs <id> [--limit <n>]\` — view execution history

### Other
- \`slay tasks list [--project <name>] [--status <status>] [--done] [--json]\` — list tasks
- \`slay tasks search <query> [--project <name>]\` — search tasks
- \`slay tasks open [id]\` — open task in SlayZone app
`
  }
]
