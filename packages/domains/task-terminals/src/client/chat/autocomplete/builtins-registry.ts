import type { BuiltinCommand, AcceptCtx } from './types'
import { rankByName } from './ranking'
import { resetChat } from './chat-actions'

/**
 * Built-in slash commands feasible over stream-json chat transport.
 * Each `run()` receives an `AcceptCtx` with chat session handles, navigation hooks, and toast.
 * Handlers prefer side-effects over text insertion — actions happen via IPC or UI events.
 *
 * Skipped from Claude Code: `/vim`, `/ide`, `/add-dir` (REPL-only), MCP prompts (no enum),
 * plugin cmds (no enum), `/compact`, `/model` (tracked in todo — multi-step UI).
 */
export const builtinCommands: BuiltinCommand[] = [
  {
    name: 'clear',
    description: 'Clear the chat — kill session and start fresh',
    async run(ctx) {
      await resetChat(ctx.chat, ctx.session, {
        interruptFirst: true,
        onSuccess: () => ctx.toast('Chat cleared'),
        onError: (err) =>
          ctx.toast(`Clear failed: ${err instanceof Error ? err.message : String(err)}`),
      }).catch(() => {
        /* handled via onError */
      })
    },
  },
  {
    name: 'help',
    description: 'Show available slash commands',
    run(ctx) {
      ctx.toast(
        'Slash commands: type / for skills, commands, agents, and built-ins. Type @ for files.'
      )
    },
  },
  {
    name: 'bug',
    description: 'Open Claude Code issue tracker',
    run(ctx) {
      ctx.navigate.openExternal('https://github.com/anthropics/claude-code/issues/new')
    },
  },
  {
    name: 'release-notes',
    description: 'Open Claude Code releases page',
    run(ctx) {
      ctx.navigate.openExternal('https://github.com/anthropics/claude-code/releases')
    },
  },
  {
    name: 'config',
    description: 'Open settings',
    run(ctx) {
      ctx.navigate.openSettings('appearance')
    },
  },
  {
    name: 'memory',
    description: 'Open project CLAUDE.md',
    run(ctx) {
      const sep = ctx.session.cwd.endsWith('/') ? '' : '/'
      ctx.navigate.openFile(`${ctx.session.cwd}${sep}CLAUDE.md`)
    },
  },
  {
    name: 'permissions',
    description: 'Open permissions settings',
    run(ctx) {
      ctx.navigate.openSettings('permissions')
    },
  },
  {
    name: 'hooks',
    description: 'Open hooks settings',
    run(ctx) {
      ctx.navigate.openSettings('hooks')
    },
  },
  {
    name: 'mcp',
    description: 'Open MCP servers settings',
    run(ctx) {
      ctx.navigate.openSettings('mcp')
    },
  },
  {
    name: 'init',
    description: 'Ask Claude to create CLAUDE.md for this project',
    async run(ctx) {
      await ctx.chat.send(
        ctx.session.tabId,
        'Initialize a CLAUDE.md file for this codebase. Include the stack, architecture, commands, and any conventions you can infer from the code.'
      )
    },
  },
  {
    name: 'review',
    description: 'Review the current diff or a PR',
    async run(ctx) {
      await ctx.chat.send(
        ctx.session.tabId,
        'Review the pending changes. Look for bugs, regressions, security issues, and anything that would not pass a thorough code review.'
      )
    },
  },
  {
    name: 'status',
    description: 'Show current chat session info',
    run(ctx) {
      ctx.toast(`Session: ${ctx.session.mode} — cwd ${ctx.session.cwd}`)
    },
  },
]

export function filterBuiltins(filter: string): BuiltinCommand[] {
  return rankByName(builtinCommands, filter, {
    getName: (b) => b.name,
    getDescription: (b) => b.description,
  })
}

export type AcceptCtxRef = AcceptCtx
