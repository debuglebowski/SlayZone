import { useState, useCallback, useRef } from 'react'
import { FileCode } from 'lucide-react'
import { useFileEditor } from './useFileEditor'
import { EditorFileTree } from './EditorFileTree'
import { EditorTabBar } from './EditorTabBar'
import { CodeEditor } from './CodeEditor'

interface FileEditorViewProps {
  projectPath: string
}

export function FileEditorView({ projectPath }: FileEditorViewProps) {
  const {
    openFiles,
    activeFile,
    activeFilePath,
    setActiveFilePath,
    openFile,
    updateContent,
    saveFile,
    closeFile,
    isDirty
  } = useFileEditor(projectPath)

  const [treeWidth, setTreeWidth] = useState(250)
  const isDragging = useRef(false)

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      isDragging.current = true
      const startX = e.clientX
      const startWidth = treeWidth

      const onMove = (e: MouseEvent) => {
        if (!isDragging.current) return
        const delta = e.clientX - startX
        setTreeWidth(Math.max(180, Math.min(500, startWidth + delta)))
      }
      const onUp = () => {
        isDragging.current = false
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [treeWidth]
  )

  const handleCloseFile = useCallback(
    (filePath: string) => {
      if (isDirty(filePath)) {
        if (!confirm('Unsaved changes will be lost. Close anyway?')) return
      }
      closeFile(filePath)
    },
    [isDirty, closeFile]
  )

  return (
    <div className="h-full flex bg-background">
      {/* File tree */}
      <div className="shrink-0 border-r overflow-hidden" style={{ width: treeWidth }}>
        <EditorFileTree
          projectPath={projectPath}
          onOpenFile={openFile}
          activeFilePath={activeFilePath}
        />
      </div>

      {/* Editor area */}
      <div className="relative flex-1 flex flex-col min-w-0">
        {/* Resize handle (overlay) */}
        <div
          className="absolute left-0 inset-y-0 w-2 -translate-x-1/2 z-10 cursor-col-resize hover:bg-primary/20 active:bg-primary/30 transition-colors"
          onMouseDown={handleResizeStart}
        />
        <EditorTabBar
          files={openFiles}
          activeFilePath={activeFilePath}
          onSelect={setActiveFilePath}
          onClose={handleCloseFile}
          isDirty={isDirty}
        />

        {activeFile ? (
          <div className="flex-1 min-h-0">
            <CodeEditor
              key={activeFile.path}
              filePath={activeFile.path}
              content={activeFile.content}
              onChange={(content) => updateContent(activeFile.path, content)}
              onSave={() => saveFile(activeFile.path)}
            />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center space-y-2">
              <FileCode className="size-8 mx-auto opacity-40" />
              <p className="text-sm">Select a file to edit</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
