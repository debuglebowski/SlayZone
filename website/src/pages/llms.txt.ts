import type { APIContext } from 'astro'
import { features, featurePath } from '../data/features.js'
import { headToHeadPages } from '../data/headToHead'

const oneLine = (value: string) => value.replace(/\s+/g, ' ').trim()

export const GET = ({ site }: APIContext) => {
  const origin = site?.origin ?? 'https://slay.zone'
  const url = (path: string) => `${origin}${path}`

  const featureLines = features
    .map(
      (feature) =>
        `- [${feature.title}](${url(featurePath(feature))}): ${oneLine(feature.shortDescription)}`,
    )
    .join('\n')

  const headToHeadLines = headToHeadPages
    .map((page) => `- [${page.title}](${url(`/${page.slug}`)}): ${oneLine(page.summary)}`)
    .join('\n')

  const body = `# SlayZone

> Desktop kanban for AI coding agents. Every card hides a terminal, browser, git worktree, and code editor. Local-first orchestration across Claude Code, Codex, Gemini, OpenCode, Cursor, and other agent CLIs.

SlayZone treats the kanban board as the primary control surface for parallel agent work. Each task owns a real PTY session, an embedded browser pane, an isolated git worktree, and task-local diff, commit, and PR workflows. The app runs fully on your machine with no mandatory account or cloud sync, and exposes an MCP server plus a \`slay\` CLI so agents and shell tooling can read and drive task state.

## Docs
- [Documentation](${url('/docs')}): Install, projects, kanban, terminals, browser, git, AI modes, \`slay\` CLI, Linear sync, privacy
- [FAQ](${url('/faq')}): Common questions about SlayZone

## Features
- [All features](${url('/features')}): Overview of SlayZone's feature surface
${featureLines}

## Comparison
- [Comparison matrix](${url('/comparison')}): SlayZone vs the field — Cursor, VibeKanban, Devin, and others
${headToHeadLines}

## Optional
- [Homepage](${url('/')}): Landing page and product overview
`

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
