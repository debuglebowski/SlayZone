import { useEffect, useRef } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { markdown } from '@codemirror/lang-markdown'
import { python } from '@codemirror/lang-python'
import { oneDark } from '@codemirror/theme-one-dark'

function getLanguage(filePath: string) {
  const ext = filePath.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'js':
    case 'jsx':
    case 'mjs':
      return javascript()
    case 'ts':
    case 'tsx':
    case 'mts':
      return javascript({ typescript: true, jsx: ext.includes('x') })
    case 'json':
      return json()
    case 'css':
      return css()
    case 'html':
    case 'htm':
      return html()
    case 'md':
    case 'mdx':
      return markdown()
    case 'py':
      return python()
    default:
      return null
  }
}

const editorTheme = EditorView.theme({
  '&': { height: '100%', fontSize: '13px', backgroundColor: 'transparent' },
  '.cm-scroller': { overflow: 'auto' },
  '.cm-content': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
  '.cm-gutters': { backgroundColor: 'transparent', border: 'none' }
})

interface CodeEditorProps {
  filePath: string
  content: string
  onChange: (content: string) => void
  onSave: () => void
  /** Bump to replace editor content from external source (e.g. disk reload) */
  version?: number
}

export function CodeEditor({ filePath, content, onChange, onSave, version }: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const onSaveRef = useRef(onSave)
  const contentRef = useRef(content)
  const suppressOnChange = useRef(false)
  onChangeRef.current = onChange
  onSaveRef.current = onSave
  contentRef.current = content

  // Create editor on mount / filePath change
  useEffect(() => {
    if (!containerRef.current) return

    const lang = getLanguage(filePath)
    const extensions = [
      basicSetup,
      editorTheme,
      oneDark,
      keymap.of([
        {
          key: 'Mod-s',
          run: () => {
            onSaveRef.current()
            return true
          }
        }
      ]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && !suppressOnChange.current) {
          onChangeRef.current(update.state.doc.toString())
        }
      })
    ]
    if (lang) extensions.splice(1, 0, lang)

    const state = EditorState.create({ doc: content, extensions })
    const view = new EditorView({ state, parent: containerRef.current })
    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
    // Intentionally only re-create on filePath change, not content
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filePath])

  // Replace editor content when version bumps (external disk reload)
  useEffect(() => {
    if (version === undefined || !viewRef.current) return
    const view = viewRef.current
    const currentDoc = view.state.doc.toString()
    if (currentDoc !== contentRef.current) {
      suppressOnChange.current = true
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: contentRef.current }
      })
      suppressOnChange.current = false
    }
  }, [version])

  return <div ref={containerRef} className="h-full w-full overflow-hidden" />
}
