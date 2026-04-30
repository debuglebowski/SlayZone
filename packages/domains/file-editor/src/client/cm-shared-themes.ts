import { EditorView } from '@codemirror/view'
import { showMinimap } from '@replit/codemirror-minimap'

/** Width (px) reserved for the CM minimap gutter — used by callers to offset
 * sibling overlays (e.g. floating TOC). Approximate; lib computes actual width. */
export const MINIMAP_GUTTER_PX = 120

/** Pill-only scrollbar (transparent track, no buttons/corners) for `.cm-scroller`. */
export const cmScrollbarTheme = EditorView.theme({
  '.cm-scroller': {
    overflow: 'auto',
    scrollbarWidth: 'thin',
    scrollbarColor: 'hsl(var(--muted-foreground) / 0.3) transparent',
  },
  '.cm-scroller::-webkit-scrollbar': { width: '6px', height: '6px' },
  '.cm-scroller::-webkit-scrollbar-track': { background: 'transparent' },
  '.cm-scroller::-webkit-scrollbar-thumb': {
    background: 'hsl(var(--muted-foreground) / 0.3)',
    borderRadius: '3px',
  },
  '.cm-scroller::-webkit-scrollbar-thumb:hover': {
    background: 'hsl(var(--muted-foreground) / 0.5)',
  },
  '.cm-scroller::-webkit-scrollbar-corner': { background: 'transparent' },
  '.cm-scroller::-webkit-scrollbar-button': { display: 'none' },
})

/** Minimap gutter styling: left-only border, surface-2 bg, padded canvas.
 * `!important` is required because the lib's own theme has higher specificity
 * (`& .cm-minimap-gutter` parent context). */
export const minimapCardTheme = EditorView.theme({
  '.cm-gutters.cm-minimap-gutter': {
    margin: '0 !important',
    borderRadius: '0 !important',
    borderTopWidth: '0 !important',
    borderRightWidth: '0 !important',
    borderBottomWidth: '0 !important',
    borderLeftWidth: '2px !important',
    borderStyle: 'solid !important',
    borderColor: 'var(--border) !important',
    background: 'var(--surface-2, var(--background)) !important',
  },
  '.cm-gutters.cm-minimap-gutter .cm-minimap-inner': {
    right: '6px !important',
    left: '6px !important',
  },
})

export function buildMinimap() {
  return [
    showMinimap.compute([], () => ({
      create: () => ({ dom: document.createElement('div') }),
      displayText: 'blocks' as const,
      showOverlay: 'always' as const,
    })),
    minimapCardTheme,
  ]
}
