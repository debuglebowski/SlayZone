import { $prose } from '@milkdown/utils'
import { Plugin, PluginKey } from '@milkdown/prose/state'
import { Decoration, DecorationSet, type EditorView } from '@milkdown/prose/view'
import type { Node as ProseNode } from '@milkdown/prose/model'

export interface SearchHighlightState {
  query: string
  activeIndex: number
  matchCase: boolean
  regex: boolean
  matches: Array<{ from: number; to: number }>
  decorations: DecorationSet
}

export interface SetSearchMeta {
  type: 'setSearch'
  query: string
  activeIndex: number
  matchCase: boolean
  regex: boolean
}

export const searchHighlightKey = new PluginKey<SearchHighlightState>('slayzoneArtifactSearch')

function findMatches(doc: ProseNode, query: string, matchCase: boolean, regex: boolean): Array<{ from: number; to: number }> {
  if (!query.trim()) return []
  let re: RegExp
  const flags = matchCase ? 'g' : 'gi'
  try {
    const pattern = regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    re = new RegExp(pattern, flags)
  } catch {
    return []
  }
  const out: Array<{ from: number; to: number }> = []
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    const text = node.text
    let m: RegExpExecArray | null
    re.lastIndex = 0
    while ((m = re.exec(text)) !== null) {
      if (m[0].length === 0) { re.lastIndex++; continue }
      out.push({ from: pos + m.index, to: pos + m.index + m[0].length })
    }
  })
  return out
}

function buildDecorations(doc: ProseNode, matches: Array<{ from: number; to: number }>, activeIndex: number): DecorationSet {
  if (matches.length === 0) return DecorationSet.empty
  const mod = ((activeIndex % matches.length) + matches.length) % matches.length
  const decos = matches.map((m, i) => Decoration.inline(m.from, m.to, {
    class: i === mod ? 'artifact-search-match artifact-search-match-active' : 'artifact-search-match',
  }))
  return DecorationSet.create(doc, decos)
}

/**
 * Milkdown plugin that highlights search matches in the document and scrolls
 * the active match into view. Drive it by dispatching a transaction with
 * `tr.setMeta(searchHighlightKey, { type: 'setSearch', query, activeIndex })`.
 *
 * `onMatchCountChange` fires when the match count changes.
 */
export function createSearchHighlightPlugin(options?: {
  onMatchCountChange?: (count: number) => void
}) {
  return $prose(() => {
    return new Plugin<SearchHighlightState>({
      key: searchHighlightKey,
      state: {
        init: () => ({ query: '', activeIndex: 0, matchCase: false, regex: false, matches: [], decorations: DecorationSet.empty }),
        apply(tr, value, _old, newState) {
          const meta = tr.getMeta(searchHighlightKey) as SetSearchMeta | undefined
          if (!meta && !tr.docChanged) {
            // Remap decorations through the tr so positions stay valid
            return { ...value, decorations: value.decorations.map(tr.mapping, tr.doc) }
          }
          const query = meta?.query ?? value.query
          const activeIndex = meta?.activeIndex ?? value.activeIndex
          const matchCase = meta?.matchCase ?? value.matchCase
          const regex = meta?.regex ?? value.regex
          const matches = findMatches(newState.doc, query, matchCase, regex)
          const decorations = buildDecorations(newState.doc, matches, activeIndex)
          return { query, activeIndex, matchCase, regex, matches, decorations }
        },
      },
      props: {
        decorations(state) {
          return this.getState(state)?.decorations ?? DecorationSet.empty
        },
      },
      view(_view: EditorView) {
        let lastCount = 0
        let lastActive = -1
        let lastQuery = ''
        return {
          update(view, prevState) {
            const s = searchHighlightKey.getState(view.state)
            if (!s) return
            if (s.matches.length !== lastCount) {
              lastCount = s.matches.length
              options?.onMatchCountChange?.(lastCount)
            }
            // Scroll the active match into view whenever activeIndex or query
            // changes (set via meta), OR when the match list grew/shrank.
            const prev = prevState ? searchHighlightKey.getState(prevState) : undefined
            const queryChanged = s.query !== lastQuery
            const activeChanged = s.activeIndex !== lastActive
            const matchesChanged = prev?.matches.length !== s.matches.length
            if ((queryChanged || activeChanged || matchesChanged) && s.matches.length > 0) {
              const mod = ((s.activeIndex % s.matches.length) + s.matches.length) % s.matches.length
              const m = s.matches[mod]
              try {
                const dom = view.domAtPos(m.from)
                const el = dom.node.nodeType === 1 ? (dom.node as HTMLElement) : (dom.node.parentElement as HTMLElement | null)
                el?.scrollIntoView({ block: 'center', behavior: 'auto' })
              } catch { /* pos may be invalid mid-transition */ }
            }
            lastActive = s.activeIndex
            lastQuery = s.query
          },
          destroy() { /* noop */ },
        }
      },
    })
  })
}

/** Dispatch a search update against a Milkdown-managed ProseMirror view. */
export function setSearch(view: EditorView, query: string, activeIndex: number, matchCase = false, regex = false): void {
  const tr = view.state.tr.setMeta(searchHighlightKey, { type: 'setSearch', query, activeIndex, matchCase, regex } satisfies SetSearchMeta)
  view.dispatch(tr)
}
