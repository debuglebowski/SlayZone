import type { SkillInfo } from '@slayzone/terminal/shared'
import type { AutocompleteSource } from '../types'
import { filterSkills } from '../../skill-filter'
import { spliceReplace } from '../useAutocomplete'
import { renderSkillItem } from './render-skill'

export function createSkillsSource(): AutocompleteSource<SkillInfo> {
  return {
    id: 'skills',
    detect(draft, cursorPos) {
      if (!draft.startsWith('/')) return null
      const rest = draft.slice(1, cursorPos)
      if (/\s/.test(rest)) return null
      return { query: rest, tokenStart: 0, tokenEnd: cursorPos }
    },
    async fetch({ cwd }) {
      const api = (window as unknown as {
        api?: { chat?: { listSkills?: (cwd: string) => Promise<SkillInfo[]> } }
      }).api
      const fn = api?.chat?.listSkills
      if (!fn) return []
      return fn(cwd)
    },
    filter: filterSkills,
    getKey: (s) => `${s.source}:${s.name}`,
    render: renderSkillItem,
    accept(skill, ctx) {
      const next = spliceReplace(ctx.draft, ctx.tokenStart, ctx.tokenEnd, `/${skill.name} `)
      ctx.setDraft(next)
    },
  }
}
