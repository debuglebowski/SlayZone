import { useState, useCallback, useRef } from 'react'

export interface OpenFile {
  path: string
  content: string
  originalContent: string
}

export function useFileEditor(projectPath: string) {
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([])
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null)
  const pendingOpen = useRef<string | null>(null)

  const openFile = useCallback(async (filePath: string) => {
    // Already open — just focus
    setOpenFiles((prev) => {
      if (prev.some((f) => f.path === filePath)) {
        return prev
      }
      return prev // will be added below
    })

    const existing = openFiles.find((f) => f.path === filePath)
    if (existing) {
      setActiveFilePath(filePath)
      return
    }

    // Prevent duplicate reads
    if (pendingOpen.current === filePath) return
    pendingOpen.current = filePath

    try {
      const content = await window.api.fs.readFile(projectPath, filePath)
      setOpenFiles((prev) => {
        if (prev.some((f) => f.path === filePath)) return prev
        return [...prev, { path: filePath, content, originalContent: content }]
      })
      setActiveFilePath(filePath)
    } finally {
      pendingOpen.current = null
    }
  }, [projectPath, openFiles])

  const updateContent = useCallback((filePath: string, content: string) => {
    setOpenFiles((prev) =>
      prev.map((f) => (f.path === filePath ? { ...f, content } : f))
    )
  }, [])

  const saveFile = useCallback(async (filePath: string) => {
    const file = openFiles.find((f) => f.path === filePath)
    if (!file || file.content === file.originalContent) return
    await window.api.fs.writeFile(projectPath, filePath, file.content)
    setOpenFiles((prev) =>
      prev.map((f) =>
        f.path === filePath ? { ...f, originalContent: f.content } : f
      )
    )
  }, [projectPath, openFiles])

  const closeFile = useCallback((filePath: string) => {
    setOpenFiles((prev) => {
      const idx = prev.findIndex((f) => f.path === filePath)
      if (idx === -1) return prev
      const next = prev.filter((f) => f.path !== filePath)
      return next
    })
    setActiveFilePath((current) => {
      if (current !== filePath) return current
      const remaining = openFiles.filter((f) => f.path !== filePath)
      return remaining.length > 0 ? remaining[remaining.length - 1].path : null
    })
  }, [openFiles])

  const isDirty = useCallback(
    (filePath: string) => {
      const file = openFiles.find((f) => f.path === filePath)
      return file ? file.content !== file.originalContent : false
    },
    [openFiles]
  )

  const activeFile = openFiles.find((f) => f.path === activeFilePath) ?? null

  return {
    openFiles,
    activeFile,
    activeFilePath,
    setActiveFilePath,
    openFile,
    updateContent,
    saveFile,
    closeFile,
    isDirty
  }
}
