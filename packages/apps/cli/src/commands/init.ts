import { Command } from 'commander'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { BUILTIN_SKILLS, PROVIDER_PATHS } from '@slayzone/ai-config/shared'
import type { CliProvider } from '@slayzone/ai-config/shared'
import { openDb, notifyApp, resolveProject, resolveProjectByPath } from '../db'

const INSTRUCTIONS = `\
# SlayZone Environment

You are running inside [SlayZone](https://slayzone.com), a desktop development environment built around a kanban board. Each task on the board is a full workspace with terminal panels, a file editor, a browser panel, and git integration. Your session is one of potentially many agents working in parallel on different tasks. A human or another agent may interact with you through the terminal.

\`$SLAYZONE_TASK_ID\` is set to the ID of the task you are running inside. Most \`slay\` commands default to it when no explicit ID is given.

## slay CLI

You can interact with SlayZone via the \`slay\` CLI. **Load the \`slay\` skill before running any \`slay\` command** — it holds the full reference of commands, flags, and domain-specific guides. Do not guess subcommands or flags.
`

export function initCommand(): Command {
  const cmd = new Command('init')
    .description('Print SlayZone templates for AI agent configuration')
    .showSuggestionAfterError(true)
    .showHelpAfterError(true)

  cmd
    .command('instructions')
    .description('Print CLAUDE.md / AGENTS.md template')
    .action(() => {
      process.stdout.write(INSTRUCTIONS)
    })

  cmd
    .command('skills')
    .description('Install all built-in slay skills for the current project')
    .option('--project <name|id>', 'Target project (defaults to project matching cwd)')
    .action(async (opts) => {
      const db = openDb()

      let projectId: string
      let projectName: string
      let projectPath: string | null

      if (opts.project) {
        const p = resolveProject(db, opts.project)
        projectId = p.id
        projectName = p.name
        const row = db.query<{ path: string | null }>(`SELECT path FROM projects WHERE id = :id`, { ':id': p.id })
        projectPath = row[0]?.path ?? null
      } else {
        const p = resolveProjectByPath(db, process.cwd())
        projectId = p.id
        projectName = p.name
        projectPath = p.path
      }

      // Resolve enabled providers for file writing
      let providers: CliProvider[] = ['claude']
      const providerRow = db.query<{ value: string }>(
        `SELECT value FROM settings WHERE key = :key`,
        { ':key': `ai_providers:${projectId}` }
      )
      if (providerRow.length > 0) {
        try {
          const parsed = JSON.parse(providerRow[0].value)
          if (Array.isArray(parsed) && parsed.length > 0) providers = parsed
        } catch { /* use default */ }
      }

      const registryId = 'builtin-slayzone'
      const installedSkills: { slug: string; content: string }[] = []

      let installed = 0
      let skipped = 0

      for (const skill of BUILTIN_SKILLS) {
        const entryId = `builtin-${skill.slug}`
        const hash = createHash('sha256').update(skill.content).digest('hex')

        const existing = db.query<{ id: string }>(
          `SELECT id FROM ai_config_items WHERE type = 'skill' AND slug = :slug AND scope = 'project' AND project_id = :projectId`,
          { ':slug': skill.slug, ':projectId': projectId }
        )

        if (existing.length > 0) {
          skipped++
          continue
        }

        const id = crypto.randomUUID()
        const now = new Date().toISOString()

        const metadata = {
          marketplace: {
            registryId,
            registryName: 'SlayZone Built-in',
            entryId,
            installedVersion: hash,
            installedAt: now
          }
        }

        db.run(
          `INSERT INTO ai_config_items (id, type, scope, project_id, name, slug, content, metadata_json, created_at, updated_at)
           VALUES (:id, 'skill', 'project', :projectId, :name, :slug, :content, :metadata, :now, :now)`,
          {
            ':id': id,
            ':projectId': projectId,
            ':name': skill.name,
            ':slug': skill.slug,
            ':content': skill.content,
            ':metadata': JSON.stringify(metadata),
            ':now': now,
          }
        )
        installedSkills.push({ slug: skill.slug, content: skill.content })
        installed++
        console.log(`  Installed ${skill.name}`)
      }

      // Write skill files to disk
      if (projectPath && installedSkills.length > 0) {
        for (const provider of providers) {
          const mapping = PROVIDER_PATHS[provider]
          if (!mapping?.skillsDir) continue
          for (const skill of installedSkills) {
            const filePath = path.join(projectPath, mapping.skillsDir, skill.slug, 'SKILL.md')
            fs.mkdirSync(path.dirname(filePath), { recursive: true })
            fs.writeFileSync(filePath, skill.content, 'utf-8')
          }
        }
      }

      db.close()

      if (installed > 0) {
        await notifyApp()
        console.log(`\nInstalled ${installed} skill${installed === 1 ? '' : 's'} for "${projectName}"${skipped > 0 ? `, ${skipped} already installed` : ''}`)
      } else {
        console.log(`All ${skipped} skills already installed for "${projectName}"`)
      }
    })

  return cmd
}
