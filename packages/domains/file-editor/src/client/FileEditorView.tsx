import { useState, useCallback, useRef, useEffect } from 'react'
import { FileCode } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button
} from '@slayzone/ui'
import { useFileEditor } from './useFileEditor'
import { EditorFileTree } from './EditorFileTree'
import { EditorTabBar } from './EditorTabBar'
import { CodeEditor } from './CodeEditor'
import { QuickOpenDialog } from './QuickOpenDialog'

interface FileEditorViewProps {
  projectPath: string
  isActive?: boolean
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024).toFixed(0)} KB`
}

export function FileEditorView({ projectPath, isActive = true }: FileEditorViewProps) {
  const {
    openFiles,
    activeFile,
    activeFilePath,
    setActiveFilePath,
    openFile,
    openFileForced,
    updateContent,
    saveFile,
    closeFile,
    isDirty,
    isFileDiskChanged,
    treeRefreshKey,
    fileVersions
  } = useFileEditor(projectPath)

  const [treeWidth, setTreeWidth] = useState(250)
  const isDragging = useRef(false)
  const [confirmClose, setConfirmClose] = useState<string | null>(null)
  const [quickOpenVisible, setQuickOpenVisible] = useState(false)

  // Cmd+P — quick open (only on active tab)
  useEffect(() => {
    if (!isActive) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault()
        setQuickOpenVisible(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isActive])

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
        setConfirmClose(filePath)
        return
      }
      closeFile(filePath)
    },
    [isDirty, closeFile]
  )

  const handleConfirmDiscard = useCallback(() => {
    if (confirmClose) {
      closeFile(confirmClose)
      setConfirmClose(null)
    }
  }, [confirmClose, closeFile])

  return (
    <div className="h-full flex bg-background">
      {/* File tree */}
      <div className="shrink-0 border-r overflow-hidden" style={{ width: treeWidth }}>
        <EditorFileTree
          projectPath={projectPath}
          onOpenFile={openFile}
          activeFilePath={activeFilePath}
          refreshKey={treeRefreshKey}
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
          diskChanged={isFileDiskChanged}
        />

        {activeFile?.tooLarge ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center space-y-3">
              <FileCode className="size-8 mx-auto opacity-40" />
              <p className="text-sm">File too large ({formatSize(activeFile.sizeBytes ?? 0)})</p>
              {(activeFile.sizeBytes ?? 0) <= 10 * 1024 * 1024 && (
                <Button variant="outline" size="sm" onClick={() => openFileForced(activeFile.path)}>
                  Open anyway
                </Button>
              )}
            </div>
          </div>
        ) : activeFile?.content != null ? (
          <div className="flex-1 min-h-0">
            <CodeEditor
              key={activeFile.path}
              filePath={activeFile.path}
              content={activeFile.content}
              onChange={(content) => updateContent(activeFile.path, content)}
              onSave={() => saveFile(activeFile.path)}
              version={fileVersions.get(activeFile.path)}
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

      {/* Quick open dialog */}
      <QuickOpenDialog
        open={quickOpenVisible}
        onOpenChange={setQuickOpenVisible}
        projectPath={projectPath}
        onOpenFile={openFile}
        refreshKey={treeRefreshKey}
      />

      {/* Unsaved changes confirmation */}
      <AlertDialog open={!!confirmClose} onOpenChange={(open) => { if (!open) setConfirmClose(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmClose?.split('/').pop()} has unsaved changes that will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDiscard}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
