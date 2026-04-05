import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { Check, AlertCircle, ExternalLink, File, FileText, Link2, Minus } from 'lucide-react'
import { Button, Textarea, cn } from '@slayzone/ui'
import type { AiConfigItem, CliProvider, SyncHealth, SyncReason } from '../shared'
import { PROVIDER_PATHS, PROVIDER_LABELS } from '../shared/provider-registry'

interface ProjectInstructionsProps {
  projectId?: string | null
  projectPath?: string | null
  onNavigateToLibrary?: () => void
}

/** De-duped file entry: one entry per unique rootInstructions path */
interface InstructionFile {
  path: string
  providers: CliProvider[]
  health: SyncHealth
}

function dedupeProviderFiles(
  providerHealth: Partial<Record<CliProvider, { health: SyncHealth; reason: SyncReason | null }>>
): InstructionFile[] {
  const byPath = new Map<string, InstructionFile>()
  for (const [provider, info] of Object.entries(providerHealth)) {
    const p = provider as CliProvider
    const rootPath = PROVIDER_PATHS[p]?.rootInstructions
    if (!rootPath || !info) continue
    const existing = byPath.get(rootPath)
    if (existing) {
      existing.providers.push(p)
      if (info.health === 'stale' || (info.health === 'not_synced' && existing.health === 'synced')) {
        existing.health = info.health
      }
    } else {
      byPath.set(rootPath, { path: rootPath, providers: [p], health: info.health })
    }
  }
  return Array.from(byPath.values())
}

function SyncStatusIcon({ health }: { health: SyncHealth }) {
  if (health === 'synced') return <Check className="size-3 text-green-500" />
  if (health === 'stale') return <AlertCircle className="size-3 text-amber-500" />
  return <Minus className="size-3 text-muted-foreground" />
}

function syncLabel(health: SyncHealth): string {
  if (health === 'synced') return 'Synced'
  if (health === 'stale') return 'Stale'
  if (health === 'not_synced') return 'Not synced'
  return 'Unmanaged'
}

export function ProjectInstructions({
  projectId,
  projectPath,
  onNavigateToLibrary,
}: ProjectInstructionsProps) {
  const [providerHealth, setProviderHealth] = useState<Partial<Record<CliProvider, { health: SyncHealth; reason: SyncReason | null }>>>({})
  const [linkedVariant, setLinkedVariant] = useState<AiConfigItem | null>(null)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const isProject = !!projectId && !!projectPath
  const files = dedupeProviderFiles(providerHealth)

  // Auto-select first file
  useEffect(() => {
    if (files.length > 0 && !selectedPath) {
      setSelectedPath(files[0].path)
    }
  }, [files, selectedPath])

  const load = useCallback(async () => {
    if (!isProject) return
    setLoading(true)
    try {
      const [result, variant] = await Promise.all([
        window.api.aiConfig.getRootInstructions(projectId!, projectPath!),
        window.api.aiConfig.getProjectInstructionVariant(projectId!),
      ])
      setProviderHealth(result.providerHealth ?? {})
      setLinkedVariant(variant ?? null)
    } finally {
      setLoading(false)
    }
  }, [isProject, projectId, projectPath])

  useEffect(() => { void load() }, [load])

  // Resizable split
  const [splitWidth, setSplitWidth] = useState(350)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const onDragStart = (e: ReactMouseEvent) => {
    e.preventDefault()
    dragging.current = true
    const onMove = (ev: globalThis.MouseEvent) => {
      if (!dragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const px = ev.clientX - rect.left
      setSplitWidth(Math.min(Math.max(px, rect.width * 0.15), rect.width * 0.5))
    }
    const onUp = () => {
      dragging.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  if (loading && files.length === 0) {
    return <p className="text-xs text-muted-foreground">Loading...</p>
  }

  return (
    <div ref={containerRef} className="flex h-full w-full overflow-hidden rounded-lg border">
      {/* Left: file list */}
      <div className="flex flex-col overflow-y-auto p-3" style={{ width: splitWidth }}>
        {/* Linked variant header */}
        <div className="shrink-0 border-b border-border/50 pb-3 mb-3">
          {linkedVariant ? (
            <div className="flex items-center gap-2 text-xs">
              <FileText className="size-3.5 shrink-0 text-primary" />
              <span className="min-w-0 truncate font-medium">{linkedVariant.slug}</span>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground">No variant linked</p>
              <Button
                size="sm"
                variant="outline"
                className="h-7 w-full text-[11px]"
                onClick={onNavigateToLibrary}
              >
                <Link2 className="size-3 mr-1" />
                Link variant
              </Button>
            </div>
          )}
        </div>

        <div className="flex-1 space-y-1">
          {files.map((file) => (
            <button
              key={file.path}
              onClick={() => setSelectedPath(file.path)}
              className={cn(
                'flex w-full flex-col gap-1 rounded-lg border px-3 py-2.5 text-left text-xs transition-colors',
                selectedPath === file.path
                  ? 'bg-primary/10 border-primary/30 text-foreground'
                  : 'border-transparent hover:bg-muted/50 text-muted-foreground'
              )}
            >
              <div className="flex items-center gap-2">
                <File className="size-4 shrink-0" />
                <span className="min-w-0 truncate font-mono text-sm">{file.path}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1 pl-6">
                {file.providers.map((p) => (
                  <span
                    key={p}
                    className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                  >
                    {PROVIDER_LABELS[p]}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-1 pl-6 text-[10px]">
                <SyncStatusIcon health={file.health} />
                <span className="text-muted-foreground">{syncLabel(file.health)}</span>
              </div>
            </button>
          ))}
          {files.length === 0 && (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">No provider files</p>
          )}
        </div>
      </div>

      {/* Drag handle */}
      <div className="relative flex w-3 shrink-0 cursor-col-resize items-center justify-center" onMouseDown={onDragStart}>
        <div className="h-full w-px bg-border" />
      </div>

      {/* Right: read-only variant content */}
      <div className="flex min-w-0 flex-1 flex-col p-3">
        {linkedVariant ? (
          <>
            <Textarea
              className="min-h-0 max-h-none flex-1 resize-none [field-sizing:fixed] font-mono text-sm opacity-80"
              value={linkedVariant.content}
              readOnly
            />
            <div className="shrink-0 pt-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px]"
                onClick={onNavigateToLibrary}
              >
                <ExternalLink className="size-3 mr-1" />
                Go to Library Variant
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
            <p>Link an instruction variant to populate provider files</p>
            <Button
              size="sm"
              variant="outline"
              onClick={onNavigateToLibrary}
            >
              <Link2 className="size-3.5 mr-1.5" />
              Go to Library
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
