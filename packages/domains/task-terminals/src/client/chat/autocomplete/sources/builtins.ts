import type { AutocompleteSource, BuiltinCommand } from '../types'
import { filterBuiltins, builtinCommands } from '../builtins-registry'
import { spliceReplace } from '../useAutocomplete'
import { renderBuiltinItem } from './render-builtin'

export function createBuiltinsSource(): AutocompleteSource<BuiltinCommand> {
  return {
    id: 'builtins',
    detect(draft, cursorPos) {
      if (!draft.startsWith('/')) return null
      const rest = draft.slice(1, cursorPos)
      if (/\s/.test(rest)) return null
      return { query: rest, tokenStart: 0, tokenEnd: cursorPos }
    },
    async fetch() {
      return builtinCommands
    },
    filter: (_items, query) => filterBuiltins(query),
    getKey: (b) => `builtin:${b.name}`,
    render: renderBuiltinItem,
    getName: (b) => b.name,
    getDescription: (b) => b.description,
    async accept(cmd, ctx) {
      // Clear the draft, then run side effect.
      const next = spliceReplace(ctx.draft, ctx.tokenStart, ctx.draft.length, '')
      ctx.setDraft(next)
      await cmd.run(ctx)
    },
  }
}
