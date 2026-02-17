import { useEffect, useState, type ChangeEvent } from 'react'
import { Button, Checkbox, Dialog, DialogContent, DialogHeader, DialogTitle, Input, Label, cn } from '@slayzone/ui'
import type { AiConfigItem, CliProvider } from '../shared'
import { PROVIDER_LABELS } from '../shared/provider-registry'

interface GlobalItemPickerProps {
  projectId: string
  projectPath: string
  existingLinks: string[]
  type?: 'skill' | 'command'
  onLoaded: () => void
  onClose: () => void
}

export function GlobalItemPicker({ projectId, projectPath, existingLinks, type, onLoaded, onClose }: GlobalItemPickerProps) {
  const [items, setItems] = useState<AiConfigItem[]>([])
  const [selectedItem, setSelectedItem] = useState<AiConfigItem | null>(null)
  const [enabledProviders, setEnabledProviders] = useState<CliProvider[]>([])
  const [selectedProviders, setSelectedProviders] = useState<CliProvider[]>([])
  const [useManualPath, setUseManualPath] = useState(false)
  const [manualPath, setManualPath] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    void (async () => {
      const [skills, commands, providers] = await Promise.all([
        !type || type === 'skill' ? window.api.aiConfig.listItems({ scope: 'global', type: 'skill' }) : Promise.resolve([]),
        !type || type === 'command' ? window.api.aiConfig.listItems({ scope: 'global', type: 'command' }) : Promise.resolve([]),
        window.api.aiConfig.getProjectProviders(projectId)
      ])
      setItems([...skills, ...commands])
      setEnabledProviders(providers)
      setSelectedProviders(providers)
    })()
  }, [projectId])

  const toggleProvider = (provider: CliProvider) => {
    setSelectedProviders(prev =>
      prev.includes(provider) ? prev.filter(p => p !== provider) : [...prev, provider]
    )
  }

  const handleLoad = async () => {
    if (!selectedItem) return
    setLoading(true)
    try {
      await window.api.aiConfig.loadGlobalItem({
        projectId,
        projectPath,
        itemId: selectedItem.id,
        providers: useManualPath ? ['claude'] : selectedProviders,
        manualPath: useManualPath ? manualPath : undefined
      })
      onLoaded()
    } catch (err) {
      console.error('Failed to load item:', err)
    } finally {
      setLoading(false)
    }
  }

  const alreadyLinked = (id: string) => existingLinks.includes(id)
  const canLoad = selectedItem && !loading && (useManualPath ? manualPath.trim() : selectedProviders.length > 0)

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
          {selectedItem && !useManualPath && (
            <div className="space-y-2">
              <Label className="text-xs">Sync to providers</Label>
              <div className="flex flex-wrap gap-2">
                {enabledProviders.map(provider => (
                  <label key={provider} className="flex items-center gap-1.5 text-sm">
                    <Checkbox
                      checked={selectedProviders.includes(provider)}
                      onCheckedChange={() => toggleProvider(provider)}
                    />
                    {PROVIDER_LABELS[provider]}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Manual path toggle */}
          {selectedItem && (
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Checkbox
                  checked={useManualPath}
                  onCheckedChange={(checked) => setUseManualPath(!!checked)}
                />
                Use custom path instead
              </label>
              {useManualPath && (
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
            <Button onClick={handleLoad} disabled={!canLoad}>
              {loading ? 'Loading...' : 'Load'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
