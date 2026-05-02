import type { AgentInfo } from '@slayzone/terminal/shared'
import type { AutocompleteSource } from '../types'
import { rankByName } from '../ranking'
import { spliceReplace } from '../useAutocomplete'
import { renderAgentItem } from './render-agent'

export function filterAgents(items: AgentInfo[], filter: string): AgentInfo[] {
  return rankByName(items, filter, {
    getName: (a) => a.name,
    getDescription: (a) => a.description,
  })
}

export function createAgentsSource(): AutocompleteSource<AgentInfo> {
  return {
    id: 'agents',
    detect(draft, cursorPos) {
      if (!draft.startsWith('/')) return null
      const rest = draft.slice(1, cursorPos)
      if (/\s/.test(rest)) return null
      return { query: rest, tokenStart: 0, tokenEnd: cursorPos }
    },
    async fetch({ cwd }) {
      const api = (window as unknown as {
        api?: { chat?: { listAgents?: (cwd: string) => Promise<AgentInfo[]> } }
      }).api
      const fn = api?.chat?.listAgents
      if (!fn) return []
      return fn(cwd)
    },
    filter: filterAgents,
    getKey: (a) => `${a.source}:${a.name}`,
    render: renderAgentItem,
    getName: (a) => a.name,
    getDescription: (a) => a.description,
    accept(agent, ctx) {
      const next = spliceReplace(
        ctx.draft,
        ctx.tokenStart,
        ctx.tokenEnd,
        `Use the ${agent.name} agent to `
      )
      ctx.setDraft(next)
    },
  }
}
