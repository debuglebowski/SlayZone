import { useEffect, useState, type ChangeEvent } from 'react'
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input, Label, cn } from '@slayzone/ui'
import type { AiConfigItem, ContextFileProvider } from '../shared'

interface GlobalItemPickerProps {
  projectId: string
  projectPath: string
  existingLinks: string[]
  onLoaded: () => void
  onClose: () => void
}

const PROVIDERS: Array<{ key: ContextFileProvider; label: string; description: string }> = [
  { key: 'claude', label: 'Claude Code', description: 'Skills → .claude/skills/, Commands → .claude/commands/' },
  { key: 'codex', label: 'Codex', description: 'agents/{name}.md' },
  { key: 'manual', label: 'Custom Path', description: 'Specify a custom relative path' }
]

export function GlobalItemPicker({ projectId, projectPath, existingLinks, onLoaded, onClose }: GlobalItemPickerProps) {
  const [items, setItems] = useState<AiConfigItem[]>([])
  const [selectedItem, setSelectedItem] = useState<AiConfigItem | null>(null)
  const [provider, setProvider] = useState<ContextFileProvider>('claude')
  const [manualPath, setManualPath] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    void (async () => {
      const skills = await window.api.aiConfig.listItems({ scope: 'global', type: 'skill' })
      const commands = await window.api.aiConfig.listItems({ scope: 'global', type: 'command' })
      setItems([...skills, ...commands])
    })()
  }, [])

  const handleLoad = async () => {
    if (!selectedItem) return
    setLoading(true)
    try {
      await window.api.aiConfig.loadGlobalItem({
        projectId,
        projectPath,
        itemId: selectedItem.id,
        provider,
        manualPath: provider === 'manual' ? manualPath : undefined
      })
      onLoaded()
    } catch (err) {
      console.error('Failed to load item:', err)
    } finally {
      setLoading(false)
    }
  }

  const alreadyLinked = (id: string) => existingLinks.includes(id)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Load from Global Repository</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Item list */}
          <div className="space-y-1">
            <Label className="text-xs">Select an item</Label>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-1">
              {items.length === 0 ? (
                <p className="p-3 text-center text-sm text-muted-foreground">
                  No global skills or commands yet. Create them in User Settings.
                </p>
              ) : (
                items.map((item) => {
                  const linked = alreadyLinked(item.id)
                  return (
                    <button
                      key={item.id}
                      disabled={linked}
                      onClick={() => setSelectedItem(item)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-sm transition-colors',
                        linked
                          ? 'cursor-not-allowed opacity-40'
                          : selectedItem?.id === item.id
                            ? 'bg-primary/10 text-foreground'
                            : 'hover:bg-muted/50'
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate font-mono">{item.slug}</span>
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase">
                        {item.type}
                      </span>
                      {linked && (
                        <span className="shrink-0 text-[10px] text-muted-foreground">Linked</span>
                      )}
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* Provider selector */}
          {selectedItem && (
            <div className="space-y-2">
              <Label className="text-xs">Target provider</Label>
              <div className="flex gap-1.5">
                {PROVIDERS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setProvider(key)}
                    className={cn(
                      'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                      provider === key
                        ? 'border-primary bg-primary/10'
                        : 'hover:bg-muted/50'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {PROVIDERS.find((p) => p.key === provider)?.description}
              </p>
              {provider === 'manual' && (
                <Input
                  className="font-mono text-xs"
                  placeholder="Relative path (e.g. .cursor/rules/my-skill.mdc)"
                  value={manualPath}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setManualPath(e.target.value)}
                />
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button
              onClick={handleLoad}
              disabled={!selectedItem || loading || (provider === 'manual' && !manualPath.trim())}
            >
              {loading ? 'Loading...' : 'Load'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
