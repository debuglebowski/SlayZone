import { $prose } from '@milkdown/utils'
import { Plugin, PluginKey } from '@milkdown/prose/state'
import { Decoration, DecorationSet } from '@milkdown/prose/view'
import type { EditorView } from '@milkdown/prose/view'
import type { Node } from '@milkdown/prose/model'

export const ASSET_LINK_PREFIX = 'artifact:'

export interface ArtifactMentionState {
  active: boolean
  query: string
  from: number // position of the trigger text start
  trigger: '@' // which trigger activated
  coords: { top: number; left: number; bottom: number } | null
}

const emptyMentionState: ArtifactMentionState = { active: false, query: '', from: 0, trigger: '@', coords: null }

/**
 * Creates two ProseMirror plugins:
 *
 * 1. `artifactLinkDecoPlugin` — Renders `[text](artifact:id)` links as styled chips
 *    and handles click to call `onArtifactClick(id)`.
 *
 * 2. `artifactMentionPlugin` — Watches for `@` input to trigger an artifact picker.
 *    Calls `onMentionChange(state)` so the parent React component can render
 *    a floating dropdown.
 */
export function createArtifactLinkPlugin(
  onArtifactClick: (artifactId: string) => void,
  onMentionChange: (state: ArtifactMentionState) => void,
) {
  // --- 1. Artifact link decorations + click handler ---
  const artifactLinkDecoPlugin = $prose(() => new Plugin({
    key: new PluginKey('artifactLinkDeco'),
    props: {
      decorations(state) {
        const decos: Decoration[] = []
        state.doc.descendants((node: Node, pos: number) => {
          if (!node.isInline || !node.marks.length) return
          for (const mark of node.marks) {
            if (mark.type.name === 'link' && typeof mark.attrs.href === 'string' && mark.attrs.href.startsWith(ASSET_LINK_PREFIX)) {
              decos.push(Decoration.inline(pos, pos + node.nodeSize, {
                class: 'artifact-link-chip',
                'data-artifact-id': mark.attrs.href.slice(ASSET_LINK_PREFIX.length),
              }))
            }
          }
        })
        return DecorationSet.create(state.doc, decos)
      },
      handleClick(_view: EditorView, _pos: number, event: MouseEvent) {
        const target = event.target as HTMLElement
        const chip = target.closest('.artifact-link-chip')
        if (!chip) return false
        const id = chip.getAttribute('data-artifact-id')
        if (id) {
          event.preventDefault()
          onArtifactClick(id)
          return true
        }
        return false
      },
    },
  }))

  // --- 2. @ mention trigger ---
  const mentionKey = new PluginKey('artifactMention')

  const artifactMentionPlugin = $prose(() => new Plugin({
    key: mentionKey,
    state: {
      init: () => emptyMentionState,
      apply(tr, prev) {
        const meta = tr.getMeta(mentionKey)
        if (meta !== undefined) return meta
        // Keep tracking if mention is active and the transaction has doc changes
        if (prev.active && tr.docChanged) {
          const { from: mentionFrom, trigger } = prev
          const cursorPos = tr.selection.from
          if (cursorPos <= mentionFrom) return emptyMentionState
          const text = tr.doc.textBetween(mentionFrom, cursorPos, '')
          // Verify trigger prefix is still intact, extract query after it
          if (!text.startsWith(trigger)) return emptyMentionState
          const query = text.slice(trigger.length)
          // Abort if query has spaces (user moved on)
          if (/\s/.test(query)) return emptyMentionState
          return { ...prev, query }
        }
        // Selection-only change while mention is active — keep state
        if (prev.active && !tr.docChanged) return prev
        return prev
      },
    },
    props: {
      handleTextInput(view, from, _to, text) {
        const state = mentionKey.getState(view.state)
        if (state?.active) return false

        // Trigger 1: `@` at word boundary
        if (text === '@') {
          const before = from > 0 ? view.state.doc.textBetween(from - 1, from) : ' '
          if (before === '' || /\s/.test(before) || from === 0) {
            requestAnimationFrame(() => {
              const coords = view.coordsAtPos(view.state.selection.from)
              const newState: ArtifactMentionState = {
                active: true, query: '', from, trigger: '@',
                coords: { top: coords.top, left: coords.left, bottom: coords.bottom },
              }
              view.dispatch(view.state.tr.setMeta(mentionKey, newState))
            })
          }
        }

        return false
      },
      handleKeyDown(view, event) {
        const state = mentionKey.getState(view.state)
        if (!state?.active) return false
        if (event.key === 'Escape') {
          view.dispatch(view.state.tr.setMeta(mentionKey, emptyMentionState))
          return true
        }
        return false
      },
    },
    view: () => ({
      update: (view: EditorView) => {
        const state = mentionKey.getState(view.state)
        if (state) {
          // Update coords when active
          if (state.active) {
            const coords = view.coordsAtPos(view.state.selection.from)
            onMentionChange({ ...state, coords: { top: coords.top, left: coords.left, bottom: coords.bottom } })
          } else {
            onMentionChange(state)
          }
        }
      },
    }),
  }))

  /** Insert an artifact link at the mention position, replacing the `@query` text */
  function insertArtifactLink(view: EditorView, artifactId: string, artifactTitle: string) {
    const state = mentionKey.getState(view.state)
    if (!state?.active) return
    const { from } = state
    const to = view.state.selection.from
    const linkText = artifactTitle
    const linkMarkdown = `[${linkText}](${ASSET_LINK_PREFIX}${artifactId})`

    // Replace @query with the link markdown
    // We need to use the schema's link mark to insert properly
    const linkMark = view.state.schema.marks.link?.create({ href: `${ASSET_LINK_PREFIX}${artifactId}` })
    if (linkMark) {
      const tr = view.state.tr
        .delete(from, to)
        .insertText(linkText, from)
        .addMark(from, from + linkText.length, linkMark)
      tr.setMeta(mentionKey, emptyMentionState)
      view.dispatch(tr)
    } else {
      // Fallback: insert as raw markdown
      const tr = view.state.tr.replaceWith(from, to, view.state.schema.text(linkMarkdown))
      tr.setMeta(mentionKey, emptyMentionState)
      view.dispatch(tr)
    }
    view.focus()
  }

  return { artifactLinkDecoPlugin, artifactMentionPlugin, insertArtifactLink }
}

/** Insert an artifact link at the current selection without needing mention state. */
export function insertArtifactLinkAtCursor(view: EditorView, artifactId: string, artifactTitle: string): void {
  const { state } = view
  const { from, to } = state.selection
  const href = `${ASSET_LINK_PREFIX}${artifactId}`
  const linkMark = state.schema.marks.link?.create({ href })
  if (linkMark) {
    const tr = state.tr
      .delete(from, to)
      .insertText(artifactTitle, from)
      .addMark(from, from + artifactTitle.length, linkMark)
    view.dispatch(tr)
  } else {
    const linkMarkdown = `[${artifactTitle}](${href})`
    const tr = state.tr.replaceWith(from, to, state.schema.text(linkMarkdown))
    view.dispatch(tr)
  }
  view.focus()
}
