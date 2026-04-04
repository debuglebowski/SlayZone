import { useCallback, useEffect, useState } from 'react'
import { Check, Plus, Trash2 } from 'lucide-react'
import { Button, Textarea, Input, cn } from '@slayzone/ui'
import type { AiConfigItem } from '../shared'

interface InstructionVariantsViewProps {
  projectId: string | null
}

export function InstructionVariantsView({ projectId }: InstructionVariantsViewProps) {
  const [variants, setVariants] = useState<AiConfigItem[]>([])
  const [projectVariantId, setProjectVariantId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editName, setEditName] = useState('')
  const [loading, setLoading] = useState(true)

  const loadVariants = useCallback(async () => {
    setLoading(true)
    try {
      const items = await window.api.aiConfig.listInstructionVariants()
      setVariants(items)
      if (projectId) {
        const pv = await window.api.aiConfig.getProjectInstructionVariant(projectId)
        setProjectVariantId(pv?.id ?? null)
      }
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { void loadVariants() }, [loadVariants])

  const handleCreate = useCallback(async () => {
    const slug = `variant-${Date.now()}`
    const created = await window.api.aiConfig.createItem({
      type: 'root_instructions',
      scope: 'global',
      slug,
      content: '',
    })
    setVariants(prev => [created, ...prev])
    setEditingId(created.id)
    setEditContent('')
    setEditName(created.name)
  }, [])

  const handleSave = useCallback(async () => {
    if (!editingId) return
    const updated = await window.api.aiConfig.updateItem({
      id: editingId,
      slug: editName || undefined,
      content: editContent,
    })
    if (updated) {
      setVariants(prev => prev.map(v => v.id === updated.id ? updated : v))
    }
    setEditingId(null)
  }, [editingId, editContent, editName])

  const handleDelete = useCallback(async (id: string) => {
    await window.api.aiConfig.deleteItem(id)
    setVariants(prev => prev.filter(v => v.id !== id))
    if (editingId === id) setEditingId(null)
    if (projectVariantId === id && projectId) {
      await window.api.aiConfig.setProjectInstructionVariant(projectId, null)
      setProjectVariantId(null)
    }
  }, [editingId, projectVariantId, projectId])

  const handleSelectForProject = useCallback(async (variantId: string | null) => {
    if (!projectId) return
    await window.api.aiConfig.setProjectInstructionVariant(projectId, variantId)
    setProjectVariantId(variantId)
  }, [projectId])

  const startEditing = (variant: AiConfigItem) => {
    setEditingId(variant.id)
    setEditContent(variant.content)
    setEditName(variant.slug)
  }

  if (loading) {
    return <p className="text-xs text-muted-foreground">Loading variants...</p>
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Instruction Variants</h3>
          <p className="text-xs text-muted-foreground">
            Create reusable instruction sets. Projects can select one variant.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={handleCreate}>
          <Plus className="size-3.5 mr-1" />
          New Variant
        </Button>
      </div>

      {variants.length === 0 && (
        <p className="text-xs text-muted-foreground py-8 text-center">
          No instruction variants yet. Create one to get started.
        </p>
      )}

      <div className="space-y-2">
        {variants.map((variant) => {
          const isEditing = editingId === variant.id
          const isSelected = projectVariantId === variant.id

          return (
            <div
              key={variant.id}
              className={cn(
                'rounded-lg border p-3 transition-colors',
                isSelected && 'ring-1 ring-primary border-primary/50'
              )}
            >
              {isEditing ? (
                <div className="space-y-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Variant name (slug)"
                    className="text-sm h-8"
                  />
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    placeholder="Instruction content..."
                    rows={8}
                    className="text-xs font-mono"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSave}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => startEditing(variant)}>
                    <p className="text-sm font-medium">{variant.slug}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {variant.content.slice(0, 120) || '(empty)'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {projectId && (
                      <Button
                        size="sm"
                        variant={isSelected ? 'default' : 'outline'}
                        onClick={() => handleSelectForProject(isSelected ? null : variant.id)}
                        className="h-7 text-xs"
                      >
                        <Check className={cn('size-3 mr-1', !isSelected && 'opacity-0')} />
                        {isSelected ? 'Selected' : 'Select'}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(variant.id)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
