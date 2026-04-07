import { useState, useEffect, useCallback, useRef, useImperativeHandle, forwardRef, type DragEvent } from 'react'
import { Paperclip, Plus, Upload, Trash2, GripVertical, FileText, Code, Globe, Image, GitBranch, Eye, Code2, Columns2, ZoomIn, ZoomOut } from 'lucide-react'
import { DndContext, PointerSensor, useSensors, useSensor, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, PanelToggle, Button, Input } from '@slayzone/ui'
import { RichTextEditor } from '@slayzone/editor'
import type { RenderMode, TaskAsset } from '@slayzone/task/shared'
import { getEffectiveRenderMode, getExtensionFromTitle, RENDER_MODE_INFO, isBinaryRenderMode } from '@slayzone/task/shared'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAssets } from './useAssets'

export interface AssetsPanelHandle {
  selectAsset: (id: string) => void
  createAsset: () => void
}

interface AssetsPanelProps {
  taskId: string
  isResizing?: boolean
}

const RENDER_MODE_ICONS: Record<RenderMode, typeof FileText> = {
  'markdown': FileText,
  'code': Code,
  'html-preview': Globe,
  'svg-preview': Image,
  'mermaid-preview': GitBranch,
  'image': Image,
  'pdf': FileText,
}

function getAssetIcon(asset: TaskAsset): typeof FileText {
  const mode = getEffectiveRenderMode(asset.title, asset.render_mode)
  return RENDER_MODE_ICONS[mode] ?? Code
}

/** Render modes that have a meaningful preview/raw distinction */
function hasPreviewToggle(mode: RenderMode): boolean {
  return mode === 'markdown' || mode === 'html-preview' || mode === 'svg-preview' || mode === 'mermaid-preview'
}

function hasZoom(mode: RenderMode): boolean {
  return mode === 'image' || mode === 'svg-preview' || mode === 'mermaid-preview'
}

// --- Sortable asset row ---

function SortableAssetRow({ asset, selected, onSelect, onDelete }: {
  asset: TaskAsset
  selected: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: asset.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const TypeIcon = getAssetIcon(asset)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-1 px-1.5 py-1 rounded text-xs group/row cursor-pointer',
        selected ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
        isDragging && 'opacity-50'
      )}
      onClick={onSelect}
    >
      <button type="button" className="shrink-0 cursor-grab opacity-0 group-hover/row:opacity-60" {...attributes} {...listeners}>
        <GripVertical className="size-3" />
      </button>
      <TypeIcon className="size-3 shrink-0" />
      <span className="truncate flex-1">{asset.title}</span>
      <button
        type="button"
        className="shrink-0 opacity-0 group-hover/row:opacity-60 hover:!opacity-100 hover:text-destructive"
        onClick={(e) => { e.stopPropagation(); onDelete() }}
      >
        <Trash2 className="size-3" />
      </button>
    </div>
  )
}

// --- Image viewer ---

function ImageViewer({ assetId, zoomLevel, onZoom, getFilePath }: { assetId: string; zoomLevel: number; onZoom: (fn: (z: number) => number) => void; getFilePath: (id: string) => Promise<string | null> }) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    getFilePath(assetId).then((p) => {
      if (p) setSrc(`slz-file://${p}`)
    })
  }, [assetId, getFilePath])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!e.metaKey && !e.ctrlKey) return
    e.preventDefault()
    onZoom(z => Math.min(4, Math.max(0.25, z + (e.deltaY > 0 ? -0.1 : 0.1))))
  }, [onZoom])

  if (!src) return <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">Loading...</div>

  return (
    <div className={cn("flex-1 p-4 overflow-auto bg-muted/20", zoomLevel <= 1 && "flex items-center justify-center")} onWheel={handleWheel}>
      <img src={src} style={zoomLevel !== 1 ? { transform: `scale(${zoomLevel})`, transformOrigin: 'top left' } : undefined} className={zoomLevel <= 1 ? "max-w-full max-h-full object-contain" : ""} alt="" />
    </div>
  )
}

// --- PDF viewer ---

function PdfViewer({ assetId, getFilePath }: { assetId: string; getFilePath: (id: string) => Promise<string | null> }) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    getFilePath(assetId).then((p) => {
      if (p) setSrc(`slz-file://${p}`)
    })
  }, [assetId, getFilePath])

  if (!src) return <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">Loading...</div>

  return <iframe src={src} className="flex-1 w-full" title="PDF preview" />
}

// --- Asset content editor ---

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export interface AssetStats {
  fileSize: number | null
  words: number
  lines: number
}

function AssetContentEditor({ asset, viewMode, zoomLevel, onZoom, readContent, saveContent, getFilePath, onStats }: {
  asset: TaskAsset
  viewMode: 'preview' | 'split' | 'raw'
  zoomLevel: number
  onZoom: (fn: (z: number) => number) => void
  readContent: (id: string) => Promise<string | null>
  saveContent: (id: string, content: string) => Promise<void>
  getFilePath: (id: string) => Promise<string | null>
  onStats?: (stats: AssetStats) => void
}) {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const contentRef = useRef(content)
  const onStatsRef = useRef(onStats)
  contentRef.current = content
  onStatsRef.current = onStats

  const renderMode = getEffectiveRenderMode(asset.title, asset.render_mode)
  const isBinary = isBinaryRenderMode(renderMode)

  // Report stats when content changes
  useEffect(() => {
    const text = content ?? ''
    const words = text.trim() ? text.trim().split(/\s+/).length : 0
    const lines = text ? text.split('\n').length : 0
    window.api.assets.getFileSize(asset.id).then((size) => {
      onStatsRef.current?.({ fileSize: size, words, lines })
    })
  }, [content, asset.id])

  // Load content when asset changes (skip for binary)
  useEffect(() => {
    if (isBinary) {
      setLoading(false)
      window.api.assets.getFileSize(asset.id).then((size) => {
        onStatsRef.current?.({ fileSize: size, words: 0, lines: 0 })
      })
      return
    }
    setLoading(true)
    readContent(asset.id).then((c) => {
      setContent(c ?? '')
      setLoading(false)
    })
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        if (contentRef.current !== null) saveContent(asset.id, contentRef.current)
      }
    }
  }, [asset.id, isBinary, readContent, saveContent])

  const handleChange = useCallback((value: string) => {
    setContent(value)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveContent(asset.id, value)
    }, 500)
  }, [asset.id, saveContent])

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">Loading...</div>
  }

  // Image render mode
  if (renderMode === 'image') {
    return <ImageViewer assetId={asset.id} zoomLevel={zoomLevel} onZoom={onZoom} getFilePath={getFilePath} />
  }

  // PDF render mode
  if (renderMode === 'pdf') {
    return <PdfViewer assetId={asset.id} getFilePath={getFilePath} />
  }

  const hasPreview = renderMode === 'markdown' || renderMode === 'html-preview' || renderMode === 'svg-preview' || renderMode === 'mermaid-preview'

  // Markdown preview — WYSIWYG editor
  if (renderMode === 'markdown' && viewMode === 'preview') {
    return (
      <div className="flex-1 overflow-y-auto">
        <RichTextEditor
          value={content ?? ''}
          onChange={handleChange}
          placeholder="Write markdown..."
          className="p-3"
        />
      </div>
    )
  }

  // Markdown split — raw left, rendered preview right
  if (renderMode === 'markdown' && viewMode === 'split') {
    return (
      <div className="flex-1 flex flex-row overflow-hidden">
        <textarea
          value={content ?? ''}
          onChange={(e) => handleChange(e.target.value)}
          className="flex-1 bg-transparent text-xs font-mono p-3 resize-none outline-none min-w-0"
          placeholder="Write markdown..."
          spellCheck={false}
        />
        <div className="flex-1 border-l border-border overflow-y-auto min-w-0">
          <div className="prose prose-sm dark:prose-invert max-w-none p-3">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content ?? ''}</ReactMarkdown>
          </div>
        </div>
      </div>
    )
  }

  // Preview-only for html/svg/mermaid
  if (hasPreview && viewMode === 'preview') {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <AssetPreview renderMode={renderMode} content={content ?? ''} zoomLevel={zoomLevel} onZoom={onZoom} />
      </div>
    )
  }

  // Split: source + preview side by side
  if (hasPreview && viewMode === 'split') {
    return (
      <div className="flex-1 flex flex-row overflow-hidden">
        <textarea
          value={content ?? ''}
          onChange={(e) => handleChange(e.target.value)}
          className="flex-1 bg-transparent text-xs font-mono p-3 resize-none outline-none min-w-0"
          placeholder={`Write ${getExtensionFromTitle(asset.title) || 'content'}...`}
          spellCheck={false}
        />
        <div className="flex-1 flex flex-col border-l border-border overflow-hidden min-w-0">
          <AssetPreview renderMode={renderMode} content={content ?? ''} zoomLevel={zoomLevel} onZoom={onZoom} />
        </div>
      </div>
    )
  }

  // Raw: source only (code, or any mode in raw view)
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <textarea
        value={content ?? ''}
        onChange={(e) => handleChange(e.target.value)}
        className="flex-1 bg-transparent text-xs font-mono p-3 resize-none outline-none"
        placeholder={`Write ${getExtensionFromTitle(asset.title) || 'content'}...`}
        spellCheck={false}
      />
    </div>
  )
}

// --- Preview pane for html/svg/mermaid ---

function AssetPreview({ renderMode, content, zoomLevel = 1, onZoom }: { renderMode: RenderMode; content: string; zoomLevel?: number; onZoom?: (fn: (z: number) => number) => void }) {
  const [mermaidSvg, setMermaidSvg] = useState<string | null>(null)

  useEffect(() => {
    if (renderMode !== 'mermaid-preview' || !content.trim()) { setMermaidSvg(null); return }
    let cancelled = false
    import('mermaid').then(async (mod) => {
      const mermaid = mod.default
      mermaid.initialize({ startOnLoad: false, theme: 'dark' })
      try {
        const { svg } = await mermaid.render(`mermaid-preview-${Date.now()}`, content)
        if (!cancelled) setMermaidSvg(svg)
      } catch {
        if (!cancelled) setMermaidSvg(null)
      }
    }).catch(() => {})
    return () => { cancelled = true }
  }, [renderMode, content])

  if (renderMode === 'html-preview') {
    return (
      <iframe
        srcDoc={content}
        sandbox="allow-scripts"
        className="flex-1 bg-white"
        title="HTML preview"
      />
    )
  }

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!e.metaKey && !e.ctrlKey) return
    e.preventDefault()
    onZoom?.(z => Math.min(4, Math.max(0.25, z + (e.deltaY > 0 ? -0.1 : 0.1))))
  }, [onZoom])

  const zoomStyle = zoomLevel !== 1 ? { transform: `scale(${zoomLevel})`, transformOrigin: 'top left' } : undefined

  if (renderMode === 'svg-preview') {
    return (
      <div className="flex-1 p-4 overflow-auto" onWheel={handleWheel}>
        <div
          style={zoomStyle}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </div>
    )
  }

  if (renderMode === 'mermaid-preview' && mermaidSvg) {
    return (
      <div className="flex-1 p-4 overflow-auto" onWheel={handleWheel}>
        <div
          style={zoomStyle}
          dangerouslySetInnerHTML={{ __html: mermaidSvg }}
        />
      </div>
    )
  }

  return null
}

// --- Main panel ---

export const AssetsPanel = forwardRef<AssetsPanelHandle, AssetsPanelProps>(function AssetsPanel({ taskId, isResizing }, ref) {
  const { assets, selectedId, setSelectedId, createAsset, updateAsset, deleteAsset, readContent, saveContent, uploadAsset, getFilePath, handleDragEnd } = useAssets(taskId)
  const [newAssetOpen, setNewAssetOpen] = useState(false)
  const [newAssetName, setNewAssetName] = useState('untitled.md')
  const [viewMode, setViewMode] = useState<'preview' | 'split' | 'raw'>('preview')
  const [zoomLevel, setZoomLevel] = useState(1)
  const [assetStats, setAssetStats] = useState<AssetStats>({ fileSize: null, words: 0, lines: 0 })
  const [dragOver, setDragOver] = useState(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const selectedAsset = assets.find(a => a.id === selectedId) ?? null
  const selectedRenderMode = selectedAsset ? getEffectiveRenderMode(selectedAsset.title, selectedAsset.render_mode) : null

  // Reset view mode and zoom when switching assets
  useEffect(() => { setViewMode('preview'); setZoomLevel(1) }, [selectedId])

  useImperativeHandle(ref, () => ({
    selectAsset: (id: string) => setSelectedId(id),
    createAsset: () => setNewAssetOpen(true),
  }), [setSelectedId])

  const handleCreateNamed = useCallback(() => {
    if (!newAssetName.trim()) return
    createAsset({ title: newAssetName.trim() })
    setNewAssetName('untitled.md')
    setNewAssetOpen(false)
  }, [createAsset, newAssetName])

  const handleUpload = useCallback(async () => {
    const result = await window.api.dialog.showOpenDialog({
      title: 'Upload Asset',
      properties: ['openFile', 'multiSelections']
    })
    if (result.canceled || !result.filePaths.length) return
    for (const filePath of result.filePaths) {
      await uploadAsset(filePath)
    }
  }, [uploadAsset])

  const handleDrop = useCallback(async (e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    // Electron exposes file paths via lastDropPaths in preload
    const paths = (window as unknown as { __slayzone_lastDropPaths?: string[] }).__slayzone_lastDropPaths
    if (paths?.length) {
      for (const p of paths) await uploadAsset(p)
    } else if (e.dataTransfer.files.length) {
      // Fallback: use File API path if available (Electron)
      for (const file of Array.from(e.dataTransfer.files)) {
        const filePath = (file as unknown as { path?: string }).path
        if (filePath) await uploadAsset(filePath)
      }
    }
  }, [uploadAsset])

  // Sidebar resize
  const DEFAULT_SIDEBAR_WIDTH = 300
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH)
  const [sidebarDragging, setSidebarDragging] = useState(false)
  const sidebarDrag = useRef<{ startX: number; startW: number } | null>(null)

  const handleSidebarMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    sidebarDrag.current = { startX: e.clientX, startW: sidebarWidth }
    setSidebarDragging(true)
    const handleMove = (ev: MouseEvent) => {
      if (!sidebarDrag.current) return
      const delta = ev.clientX - sidebarDrag.current.startX
      setSidebarWidth(Math.max(100, Math.min(400, sidebarDrag.current.startW + delta)))
    }
    const handleUp = () => {
      sidebarDrag.current = null
      setSidebarDragging(false)
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleUp)
    }
    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleUp)
  }, [sidebarWidth])

  return (
    <div
      className={cn("flex flex-col h-full", dragOver && "ring-2 ring-primary/50 ring-inset")}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Panel header */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border shrink-0">
        <Paperclip className="size-3.5 text-muted-foreground" />
        <span className="text-xs font-medium">Assets</span>
        <span className="text-[10px] text-muted-foreground">{assets.length}</span>
        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="outline" size="sm" className="!h-6 text-[10px] px-2" onClick={handleUpload}>
            <Upload className="size-3 mr-1" />
            Upload
          </Button>
          <Button variant="outline" size="sm" className="!h-6 text-[10px] px-2" onClick={() => setNewAssetOpen(true)}>
            <Plus className="size-3 mr-1" />
            New
          </Button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left sidebar — asset list */}
        <div className="shrink-0 overflow-y-auto p-1.5" style={{ width: sidebarWidth }}>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={assets.map(a => a.id)} strategy={verticalListSortingStrategy}>
              {assets.map(asset => (
                <SortableAssetRow
                  key={asset.id}
                  asset={asset}
                  selected={asset.id === selectedId}
                  onSelect={() => setSelectedId(asset.id)}
                  onDelete={() => deleteAsset(asset.id)}
                />
              ))}
            </SortableContext>
          </DndContext>
          {assets.length === 0 && (
            <div className="text-[10px] text-muted-foreground/60 text-center py-4">
              No assets yet
            </div>
          )}
        </div>

        {/* Resize handle between sidebar and content */}
        <div
          className="w-1 shrink-0 cursor-col-resize bg-border hover:bg-primary/40 transition-colors"
          onMouseDown={handleSidebarMouseDown}
          onDoubleClick={() => setSidebarWidth(DEFAULT_SIDEBAR_WIDTH)}
        />

        {/* Right content area */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          {(isResizing || sidebarDragging) && <div className="absolute inset-0 z-10" />}
          {selectedAsset ? (
            <>
              <AssetContentEditor
                key={selectedAsset.id}
                asset={selectedAsset}
                viewMode={viewMode}
                zoomLevel={zoomLevel}
                onZoom={(fn) => setZoomLevel(fn)}
                readContent={readContent}
                saveContent={saveContent}
                getFilePath={getFilePath}
                onStats={setAssetStats}
              />
              {/* Content footer */}
              <div className="flex items-center gap-2 px-3 py-2 border-t border-border shrink-0">
                {/* Stats (left) */}
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  {assetStats.fileSize != null && <span><span className="text-muted-foreground/60">Size:</span> {formatFileSize(assetStats.fileSize)}</span>}
                  {!isBinaryRenderMode(selectedRenderMode!) && (
                    <>
                      <span><span className="text-muted-foreground/60">Words:</span> {assetStats.words}</span>
                      <span><span className="text-muted-foreground/60">Lines:</span> {assetStats.lines}</span>
                    </>
                  )}
                </div>
                <div className="flex-1" />
                {/* Zoom controls */}
                {selectedRenderMode && hasZoom(selectedRenderMode) && (
                  <div className="flex items-center gap-1">
                    <button type="button" className="size-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground" onClick={() => setZoomLevel(z => Math.max(0.25, z - 0.25))}>
                      <ZoomOut className="size-3.5" />
                    </button>
                    <button type="button" className="text-[10px] text-muted-foreground hover:text-foreground min-w-[3ch] text-center" onClick={() => setZoomLevel(1)}>
                      {Math.round(zoomLevel * 100)}%
                    </button>
                    <button type="button" className="size-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground" onClick={() => setZoomLevel(z => Math.min(4, z + 0.25))}>
                      <ZoomIn className="size-3.5" />
                    </button>
                  </div>
                )}
                {/* View mode toggle + render mode (right) */}
                {selectedRenderMode && hasPreviewToggle(selectedRenderMode) && (
                  <PanelToggle
                    panels={[
                      { id: 'preview', icon: Eye, label: 'Preview', active: viewMode === 'preview' },
                      { id: 'split', icon: Columns2, label: 'Split', active: viewMode === 'split' },
                      { id: 'raw', icon: Code2, label: 'Raw', active: viewMode === 'raw' },
                    ]}
                    onChange={(id) => setViewMode(id as 'preview' | 'split' | 'raw')}
                  />
                )}
                <Select
                  value={selectedAsset.render_mode ?? '__auto__'}
                  onValueChange={(v) => updateAsset({ id: selectedAsset.id, renderMode: v === '__auto__' ? null : v as RenderMode })}
                >
                  <SelectTrigger size="sm" className="!h-8 text-xs w-auto min-w-0 gap-1.5 px-2.5 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" side="top" className="max-h-none overflow-y-visible">
                    <SelectItem value="__auto__">
                      Auto ({RENDER_MODE_INFO[getEffectiveRenderMode(selectedAsset.title, null)].label})
                    </SelectItem>
                    {(Object.keys(RENDER_MODE_INFO) as RenderMode[]).map((mode) => (
                      <SelectItem key={mode} value={mode}>{RENDER_MODE_INFO[mode].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground/60">
              {assets.length > 0 ? 'Select an asset' : 'Create an asset to get started'}
            </div>
          )}
        </div>
      </div>

      {/* New asset dialog */}
      <Dialog open={newAssetOpen} onOpenChange={setNewAssetOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>New Asset</DialogTitle></DialogHeader>
          <Input
            value={newAssetName}
            onChange={(e) => setNewAssetName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateNamed() }}
            placeholder="filename.md"
            autoFocus
          />
          <DialogFooter>
            <Button size="sm" onClick={handleCreateNamed}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
})
