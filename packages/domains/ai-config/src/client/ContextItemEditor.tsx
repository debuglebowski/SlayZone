import { useEffect, useState, type ChangeEvent } from 'react'
import { ArrowUpCircle, Store, Trash2 } from 'lucide-react'
import { Button, Input, Label, Textarea } from '@slayzone/ui'
import { repairSkillFrontmatter } from '../shared'
import type { AiConfigItem, SkillUpdateInfo, SkillValidationState, UpdateAiConfigItemInput } from '../shared'
import { getMarketplaceProvenance, getSkillFrontmatterActionLabel, getSkillValidation } from './skill-validation'
import { useContextManagerStore } from './useContextManagerStore'

interface ContextItemEditorProps {
  item: AiConfigItem
  validationState?: SkillValidationState | null
  onUpdate: (patch: Omit<UpdateAiConfigItemInput, 'id'>) => Promise<void>
  onDelete: () => Promise<void>
  onClose: () => void
  readOnly?: boolean
  updateInfo?: SkillUpdateInfo | null
  onMarketplaceUpdate?: () => void
}

export function ContextItemEditor({ item, validationState, onUpdate, onDelete, onClose, readOnly, updateInfo, onMarketplaceUpdate }: ContextItemEditorProps) {
  const provenance = getMarketplaceProvenance(item)
  const navigateToRegistry = useContextManagerStore((s) => s.navigateToMarketplaceRegistry)
  const [slug, setSlug] = useState(item.slug)
  const [content, setContent] = useState(item.content)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const effectiveValidation = validationState ?? getSkillValidation({
    type: item.type,
    slug: item.slug,
    content
  })

  useEffect(() => {
    setSlug(item.slug)
    setContent(item.content)
  }, [item.slug, item.content])

  const save = async (patch: Omit<UpdateAiConfigItemInput, 'id'>) => {
    setSaving(true)
    setError(null)
    try {
      await onUpdate(patch)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const isJson = slug.endsWith('.json')
  const jsonError = isJson && content.trim()
    ? (() => { try { JSON.parse(content); return null } catch (e) { return (e as Error).message } })()
    : null

  const fixFrontmatterLabel = getSkillFrontmatterActionLabel(effectiveValidation)

  const handleFixFrontmatter = async () => {
    const nextContent = repairSkillFrontmatter(item.slug, content)
    setContent(nextContent)
    await save({ content: nextContent })
  }

  return (
    <div className="flex-1 flex flex-col space-y-3">
      <div className="space-y-1">
        <Label className="text-xs">Filename</Label>
        <Input
          data-testid="context-item-editor-slug"
          className="font-mono text-sm"
          placeholder="my-skill.md"
          value={slug}
          readOnly={readOnly}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setSlug(e.target.value)
            setError(null)
          }}
          onBlur={(e: ChangeEvent<HTMLInputElement>) => {
            if (readOnly) return
            const nextSlug = e.currentTarget.value
            setSlug(nextSlug)
            void save({ slug: nextSlug })
          }}
        />
      </div>

      {provenance && (
        <div className="flex items-center justify-between rounded border border-border/50 bg-surface-3/50 px-2.5 py-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Store className="size-3" />
            <button
              onClick={() => navigateToRegistry(provenance.registryId)}
              className="hover:text-foreground transition-colors"
            >
              From <span className="font-medium text-foreground">{provenance.registryName ?? 'Marketplace'}</span>
            </button>
            {provenance.installedAt && (
              <span className="text-muted-foreground/60">· Installed {new Date(provenance.installedAt).toLocaleDateString()}</span>
            )}
          </div>
          {updateInfo && onMarketplaceUpdate && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[11px] gap-1 text-amber-500 border-amber-500/30"
              onClick={onMarketplaceUpdate}
            >
              <ArrowUpCircle className="size-3" />
              Update available
            </Button>
          )}
        </div>
      )}

      <div className="flex-1 flex flex-col space-y-1">
        <Label className="text-xs">Content</Label>
        <Textarea
          data-testid="context-item-editor-content"
          className="flex-1 min-h-48 max-h-none field-sizing-fixed font-mono text-sm resize-none"
          placeholder="Write your content here..."
          value={content}
          readOnly={readOnly}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
            setContent(e.target.value)
            setError(null)
          }}
          onBlur={(e: ChangeEvent<HTMLTextAreaElement>) => {
            if (readOnly) return
            const nextContent = e.currentTarget.value
            setContent(nextContent)
            void save({ content: nextContent })
          }}
        />
      </div>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {effectiveValidation && effectiveValidation.status !== 'valid' && (
        <div className="rounded border border-destructive/20 bg-destructive/5 px-2.5 py-2">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs font-medium text-destructive">
              {effectiveValidation.status === 'invalid' ? 'Frontmatter is invalid' : 'Frontmatter warning'}
            </p>
            {fixFrontmatterLabel && (
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[11px]"
                data-testid="context-item-editor-fix-frontmatter"
                onClick={() => void handleFixFrontmatter()}
              >
                {fixFrontmatterLabel}
              </Button>
            )}
          </div>
          <div className="mt-1 space-y-0.5">
            {effectiveValidation.issues.map((issue, index) => (
              <p key={`${issue.code}-${index}`} className="text-[11px] text-destructive/90">
                {issue.line ? `Line ${issue.line}: ` : ''}
                {issue.message}
              </p>
            ))}
          </div>
        </div>
      )}

      {isJson && jsonError && (
        <div className="rounded border border-destructive/20 bg-destructive/5 px-2.5 py-2">
          <p className="text-[11px] text-destructive">{jsonError}</p>
        </div>
      )}
      {isJson && !jsonError && content.trim() && (
        <p className="text-[11px] text-green-600 dark:text-green-400">Valid JSON</p>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        <Button size="sm" variant="ghost" onClick={onClose} data-testid="context-item-editor-close">
          Close
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">
            {readOnly ? 'Read-only (library skill)' : saving ? 'Saving...' : 'Autosave on blur'}
          </span>
          {!readOnly && (
            <Button size="sm" variant="ghost" className="text-destructive" onClick={onDelete}>
              <Trash2 className="mr-1 size-3" />
              Delete
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
