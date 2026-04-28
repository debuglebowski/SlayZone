/**
 * Milkdown HTML render plugin
 *
 * Upstream `@milkdown/preset-commonmark` registers `htmlSchema` as an inline
 * atom whose toDOM sets textContent — so block HTML like `<p align="center">…</p>`
 * renders as literal text inside an auto-wrapped paragraph.
 *
 * This plugin:
 *   1. Splits mdast `html` nodes into `htmlBlock` (parent is a block container)
 *      vs `htmlInline` (parent is an inline-content container) via remark.
 *   2. Registers two ProseMirror schemas matching those new mdast types so the
 *      upstream `htmlSchema.parseMarkdown` matcher (which still matches `html`)
 *      never fires.
 *   3. Renders each via a NodeView that sets DOMPurify-sanitized innerHTML
 *      with optional src/href resolution and click interception.
 *
 * Roundtrip: toMarkdown emits mdast `{ type: "html", value }` — byte-identical
 * to upstream's serializer. Source preserved across save/load.
 */
import type { MilkdownPlugin } from '@milkdown/ctx'
import { $nodeSchema, $remark, $view } from '@milkdown/utils'
import DOMPurify, { type Config as DOMPurifyConfig } from 'dompurify'
import { visit } from 'unist-util-visit'
import type { Plugin as UnifiedPlugin } from 'unified'
import type { Root, Parent } from 'mdast'

export interface HtmlRenderOptions {
  /**
   * Resolve a URL from raw HTML to a loadable URL. Receives the original
   * attribute value (e.g. `./foo.png`); return the rewritten value (e.g.
   * `slz-file:///abs/path/foo.png`). Return as-is to skip rewriting.
   * Called for both `<img src>` and `<a href>`.
   */
  resolveSrc?: (src: string) => string
  /**
   * Click handler for `<a href>` inside HTML. The plugin always
   * preventDefault()s the click to stop the renderer from navigating; this
   * callback decides what to do (open in editor, shell.openPath, etc.).
   * Receives the *resolved* href and the *original* href.
   */
  onLinkClick?: (resolvedHref: string, originalHref: string) => void
}

// ---------------------------------------------------------------------------
// Sanitizer config
// ---------------------------------------------------------------------------

const SANITIZE_CONFIG: DOMPurifyConfig = {
  ADD_ATTR: ['align', 'target'],
  FORBID_TAGS: ['script', 'style'],
}

function sanitize(html: string): string {
  return DOMPurify.sanitize(html, SANITIZE_CONFIG) as unknown as string
}

const ABSOLUTE_URL_RE = /^([a-z][a-z0-9+.-]*:|\/\/|#|mailto:)/i

function rewriteAttr(value: string | null, resolveSrc?: (s: string) => string): string | null {
  if (!value || !resolveSrc) return value
  if (ABSOLUTE_URL_RE.test(value)) return value
  return resolveSrc(value)
}

/**
 * Render HTML into a fragment with attribute rewriting + anchor click handling.
 * Returns a DocumentFragment. Caller appends to live DOM.
 */
function renderHtmlFragment(value: string, opts: HtmlRenderOptions): DocumentFragment {
  // Use <template> so img/iframe inside are inert (don't fetch with original src
  // before we rewrite). Plain <div>.innerHTML triggers immediate image loads.
  const tmpl = document.createElement('template')
  tmpl.innerHTML = sanitize(value ?? '')

  if (opts.resolveSrc) {
    tmpl.content.querySelectorAll('img[src]').forEach((el) => {
      const img = el as HTMLImageElement
      const next = rewriteAttr(img.getAttribute('src'), opts.resolveSrc)
      if (next != null) img.setAttribute('src', next)
    })
    tmpl.content.querySelectorAll('a[href]').forEach((el) => {
      const a = el as HTMLAnchorElement
      const next = rewriteAttr(a.getAttribute('href'), opts.resolveSrc)
      if (next != null) a.setAttribute('href', next)
    })
  }

  return tmpl.content
}

function attachLinkClick(dom: HTMLElement, opts: HtmlRenderOptions): () => void {
  const handler = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null
    const a = target?.closest('a') as HTMLAnchorElement | null
    if (!a || !dom.contains(a)) return
    e.preventDefault()
    e.stopPropagation()
    const resolved = a.getAttribute('href') ?? ''
    // Original href can't easily be recovered post-rewrite; pass resolved twice.
    // Caller treats `resolved` as authoritative.
    opts.onLinkClick?.(resolved, resolved)
  }
  dom.addEventListener('click', handler)
  return () => dom.removeEventListener('click', handler)
}

// ---------------------------------------------------------------------------
// 1. Remark plugin — retype mdast `html` nodes by parent context
// ---------------------------------------------------------------------------

const BLOCK_PARENTS = new Set([
  'root',
  'blockquote',
  'listItem',
  'footnoteDefinition',
  'tableRow',
  'tableCell',
])

const splitHtmlNodes: UnifiedPlugin<[], Root> = () => (tree) => {
  visit(tree, 'html', (node, _index, parent: Parent | undefined) => {
    const parentType = parent?.type ?? 'root'
    ;(node as unknown as { type: string }).type = BLOCK_PARENTS.has(parentType)
      ? 'htmlBlock'
      : 'htmlInline'
  })
}

const remarkHtmlSplitPlugin = $remark(
  'remarkHtmlSplit',
  () => splitHtmlNodes,
  ['htmlBlock', 'htmlInline']
)

// ---------------------------------------------------------------------------
// 2. Block HTML schema
// ---------------------------------------------------------------------------

const htmlBlockSchema = $nodeSchema('htmlBlock', () => ({
  group: 'block',
  atom: true,
  isolating: true,
  selectable: true,
  attrs: {
    value: { default: '' },
  },
  parseMarkdown: {
    match: (node) => node.type === 'htmlBlock',
    runner: (state, node, type) => {
      state.addNode(type, { value: (node.value as string) ?? '' })
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === 'htmlBlock',
    runner: (state, node) => {
      state.addNode('html', undefined, node.attrs.value as string)
    },
  },
  parseDOM: [
    {
      tag: 'div[data-type="html-block"]',
      getAttrs: (dom) => ({
        value: (dom as HTMLElement).dataset.value ?? '',
      }),
    },
  ],
  toDOM: (node) => [
    'div',
    { 'data-type': 'html-block', 'data-value': node.attrs.value as string },
  ],
}))

// ---------------------------------------------------------------------------
// 3. Inline HTML schema
// ---------------------------------------------------------------------------

const htmlInlineSchema = $nodeSchema('htmlInline', () => ({
  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,
  attrs: {
    value: { default: '' },
  },
  parseMarkdown: {
    match: (node) => node.type === 'htmlInline',
    runner: (state, node, type) => {
      state.addNode(type, { value: (node.value as string) ?? '' })
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === 'htmlInline',
    runner: (state, node) => {
      state.addNode('html', undefined, node.attrs.value as string)
    },
  },
  parseDOM: [
    {
      tag: 'span[data-type="html-inline"]',
      getAttrs: (dom) => ({
        value: (dom as HTMLElement).dataset.value ?? '',
      }),
    },
  ],
  toDOM: (node) => [
    'span',
    { 'data-type': 'html-inline', 'data-value': node.attrs.value as string },
  ],
}))

// ---------------------------------------------------------------------------
// 4. Plugin factory — binds NodeViews to per-editor options
// ---------------------------------------------------------------------------

export function htmlRenderPlugin(opts: HtmlRenderOptions = {}): MilkdownPlugin[] {
  const htmlBlockView = $view(htmlBlockSchema.node, () => {
    return (initialNode) => {
      let currentNode = initialNode
      const dom = document.createElement('div')
      dom.setAttribute('data-type', 'html-block')
      dom.contentEditable = 'false'
      dom.style.userSelect = 'text'
      dom.replaceChildren(renderHtmlFragment((currentNode.attrs.value as string) ?? '', opts))
      const detachClick = attachLinkClick(dom, opts)

      return {
        dom,
        update(updatedNode) {
          if (updatedNode.type.name !== 'htmlBlock') return false
          if (updatedNode.attrs.value !== currentNode.attrs.value) {
            dom.replaceChildren(renderHtmlFragment((updatedNode.attrs.value as string) ?? '', opts))
          }
          currentNode = updatedNode
          return true
        },
        selectNode() {
          dom.classList.add('ProseMirror-selectednode')
        },
        deselectNode() {
          dom.classList.remove('ProseMirror-selectednode')
        },
        ignoreMutation() {
          return true
        },
        destroy() {
          detachClick()
        },
      }
    }
  })

  const htmlInlineView = $view(htmlInlineSchema.node, () => {
    return (initialNode) => {
      let currentNode = initialNode
      const dom = document.createElement('span')
      dom.setAttribute('data-type', 'html-inline')
      dom.replaceChildren(renderHtmlFragment((currentNode.attrs.value as string) ?? '', opts))
      const detachClick = attachLinkClick(dom, opts)

      return {
        dom,
        update(updatedNode) {
          if (updatedNode.type.name !== 'htmlInline') return false
          if (updatedNode.attrs.value !== currentNode.attrs.value) {
            dom.replaceChildren(renderHtmlFragment((updatedNode.attrs.value as string) ?? '', opts))
          }
          currentNode = updatedNode
          return true
        },
        ignoreMutation() {
          return true
        },
        destroy() {
          detachClick()
        },
      }
    }
  })

  return [
    ...remarkHtmlSplitPlugin,
    ...htmlBlockSchema,
    htmlBlockView,
    ...htmlInlineSchema,
    htmlInlineView,
  ]
}
