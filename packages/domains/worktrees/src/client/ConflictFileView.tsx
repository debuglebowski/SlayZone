import { useCallback, useEffect, useRef, useState } from 'react'
import { Sparkles, Check, ArrowLeft, ArrowRight } from 'lucide-react'
import { Button } from '@slayzone/ui'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { javascript } from '@codemirror/lang-javascript'
import type { ConflictFileContent, ConflictAnalysis } from '../shared/types'

interface ConflictFileViewProps {
  repoPath: string
  filePath: string
  terminalMode: string
  onResolved: () => void
}

const editorTheme = EditorView.theme({
  '&': { height: '100%', fontSize: '13px' },
  '.cm-scroller': { overflow: 'auto' },
  '.cm-content': { fontFamily: 'ui-monospace, monospace' }
})

export function ConflictFileView({ repoPath, filePath, terminalMode, onResolved }: ConflictFileViewProps) {
  const [content, setContent] = useState<ConflictFileContent | null>(null)
  const [analysis, setAnalysis] = useState<ConflictAnalysis | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [resolved, setResolved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  // Load conflict content
  useEffect(() => {
    window.api.git.getConflictContent(repoPath, filePath).then(setContent)
  }, [repoPath, filePath])

  // Init CodeMirror editor
  useEffect(() => {
    if (!editorRef.current || !content?.merged) return

    const state = EditorState.create({
      doc: content.merged,
      extensions: [basicSetup, javascript(), editorTheme]
    })

    const view = new EditorView({ state, parent: editorRef.current })
    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [content?.merged])

  const setEditorContent = useCallback((text: string) => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: text }
    })
  }, [])

  const getEditorContent = useCallback((): string => {
    return viewRef.current?.state.doc.toString() ?? ''
  }, [])

  const handleAcceptOurs = useCallback(async () => {
    if (!content?.ours) return
    setEditorContent(content.ours)
    await resolveWithContent(content.ours)
  }, [content, setEditorContent])

  const handleAcceptTheirs = useCallback(async () => {
    if (!content?.theirs) return
    setEditorContent(content.theirs)
    await resolveWithContent(content.theirs)
  }, [content, setEditorContent])

  const handleApplySuggestion = useCallback(async () => {
    if (!analysis?.suggestion) return
    setEditorContent(analysis.suggestion)
    await resolveWithContent(analysis.suggestion)
  }, [analysis, setEditorContent])

  const handleMarkResolved = useCallback(async () => {
    const text = getEditorContent()
    await resolveWithContent(text)
  }, [getEditorContent])

  const resolveWithContent = useCallback(async (text: string) => {
    setError(null)
    try {
      await window.api.git.writeResolvedFile(repoPath, filePath, text)
      await window.api.git.stageFile(repoPath, filePath)
      setResolved(true)
      onResolved()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [repoPath, filePath, onResolved])

  const handleAnalyze = useCallback(async () => {
    if (!content || terminalMode === 'terminal') return
    setAnalyzing(true)
    setError(null)
    try {
      const result = await window.api.git.analyzeConflict(
        terminalMode,
        filePath,
        content.base,
        content.ours,
        content.theirs
      )
      setAnalysis(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setAnalyzing(false)
    }
  }, [content, terminalMode, filePath])

  if (!content) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-xs text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="shrink-0 px-4 py-2 border-b flex items-center gap-2 flex-wrap">
        <span className="text-xs font-mono text-muted-foreground mr-auto">{filePath}</span>

        <Button
          variant="outline"
          size="sm"
          className="gap-1 h-7 text-xs"
          onClick={handleAcceptOurs}
          disabled={resolved || !content.ours}
        >
          <ArrowLeft className="h-3 w-3" /> Accept Ours
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1 h-7 text-xs"
          onClick={handleAcceptTheirs}
          disabled={resolved || !content.theirs}
        >
          Accept Theirs <ArrowRight className="h-3 w-3" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1 h-7 text-xs"
          onClick={handleAnalyze}
          disabled={analyzing || terminalMode === 'terminal'}
        >
          <Sparkles className="h-3 w-3" />
          {analyzing ? 'Analyzing...' : 'Analyze with AI'}
        </Button>
        {analysis?.suggestion && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1 h-7 text-xs"
            onClick={handleApplySuggestion}
            disabled={resolved}
          >
            Apply AI Suggestion
          </Button>
        )}
        <Button
          size="sm"
          className="gap-1 h-7 text-xs"
          onClick={handleMarkResolved}
          disabled={resolved}
        >
          <Check className="h-3 w-3" /> Mark Resolved
        </Button>
      </div>

      {error && (
        <div className="px-4 py-1 bg-destructive/10 text-destructive text-xs">{error}</div>
      )}

      {resolved && (
        <div className="px-4 py-1 bg-green-500/10 text-green-600 dark:text-green-400 text-xs">
          File resolved and staged
        </div>
      )}

      {/* AI analysis summary */}
      {analysis && (
        <div className="shrink-0 px-4 py-2 border-b bg-muted/30">
          <p className="text-xs font-medium text-muted-foreground mb-1">AI Analysis</p>
          <p className="text-xs">{analysis.summary}</p>
        </div>
      )}

      {/* Three-pane view: ours | editor | theirs */}
      <div className="flex-1 min-h-0 flex">
        {/* Ours (read-only) */}
        <div className="w-1/3 border-r overflow-auto">
          <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase bg-blue-500/10 border-b sticky top-0">
            Ours (current branch)
          </div>
          <pre className="p-2 text-xs font-mono whitespace-pre-wrap break-words">
            {content.ours ?? '(file did not exist)'}
          </pre>
        </div>

        {/* Editor (editable result) */}
        <div className="w-1/3 border-r flex flex-col">
          <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase bg-purple-500/10 border-b sticky top-0">
            Result (edit to resolve)
          </div>
          <div ref={editorRef} className="flex-1 min-h-0 overflow-auto" />
        </div>

        {/* Theirs (read-only) */}
        <div className="w-1/3 overflow-auto">
          <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase bg-yellow-500/10 border-b sticky top-0">
            Theirs (incoming branch)
          </div>
          <pre className="p-2 text-xs font-mono whitespace-pre-wrap break-words">
            {content.theirs ?? '(file did not exist)'}
          </pre>
        </div>
      </div>
    </div>
  )
}
