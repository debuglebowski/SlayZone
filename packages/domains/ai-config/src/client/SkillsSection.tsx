import { useCallback, useEffect, useState } from 'react'
import { SkillGraphCanvas } from './SkillGraphCanvas'
import { SkillListView } from './SkillListView'
import { ContextItemEditor } from './ContextItemEditor'
import { GlobalContextFiles } from './GlobalContextFiles'
import { SkillViewToggle, type SkillViewMode } from './SkillViewToggle'
import { getSkillValidation } from './skill-validation'
import { buildDefaultSkillContent } from '../shared'
import type { AiConfigItem, AiConfigScope, ConfigLevel, UpdateAiConfigItemInput } from '../shared'

interface SkillsSectionProps {
  level: ConfigLevel
  projectId: string | null
  projectPath?: string | null
}

function nextAvailableSlug(base: string, existingSlugs: Set<string>): string {
  if (!existingSlugs.has(base)) return base
  let i = 2
  while (existingSlugs.has(`${base}-${i}`)) i += 1
  return `${base}-${i}`
}

const VIEW_MODE_KEY = 'slayzone:skill-view-mode'

export function SkillsSection({ level, projectId, projectPath }: SkillsSectionProps) {
  const scope: AiConfigScope = level === 'library' ? 'global' : 'project'
  const isProject = level === 'project' && !!projectId && !!projectPath

  const [items, setItems] = useState<AiConfigItem[]>([])
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<SkillViewMode>(() => {
    try { return (localStorage.getItem(VIEW_MODE_KEY) as SkillViewMode) || 'list' } catch { return 'list' }
  })

  useEffect(() => {
    let stale = false
    void (async () => {
      const rows = await window.api.aiConfig.listItems({
        scope,
        projectId: isProject ? projectId : undefined,
        type: 'skill',
      })
      if (!stale) setItems(rows)
    })()
    return () => { stale = true }
  }, [scope, isProject, projectId])

  const handleViewModeChange = useCallback((mode: SkillViewMode) => {
    setViewMode(mode)
    try { localStorage.setItem(VIEW_MODE_KEY, mode) } catch { /* ignore */ }
  }, [])

  const handleUpdateItem = useCallback(async (id: string, patch: Omit<UpdateAiConfigItemInput, 'id'>) => {
    const updated = await window.api.aiConfig.updateItem({ id, ...patch })
    if (updated) setItems(prev => prev.map(i => i.id === updated.id ? updated : i))
  }, [])

  const handleDeleteItem = useCallback(async (id: string) => {
    await window.api.aiConfig.deleteItem(id)
    setItems(prev => prev.filter(i => i.id !== id))
    if (selectedSkillId === id) setSelectedSkillId(null)
  }, [selectedSkillId])

  const handleCreateSkill = useCallback(async () => {
    const existingSlugs = new Set(items.map(i => i.slug))
    const slug = nextAvailableSlug('new-skill', existingSlugs)
    const created = await window.api.aiConfig.createItem({
      type: 'skill',
      scope,
      projectId: isProject ? projectId : undefined,
      slug,
      content: buildDefaultSkillContent(slug),
    })
    setItems(prev => [created, ...prev])
    setSelectedSkillId(created.id)
  }, [items, scope, isProject, projectId])

  // Computer level — show global files filtered to skills
  if (level === 'computer') {
    return <GlobalContextFiles filter="skill" />
  }

  // Project + Library levels — graph or list view with editor panel
  const selectedItem = items.find(i => i.id === selectedSkillId) ?? null
  const validation = selectedItem ? getSkillValidation(selectedItem) : null

  return (
    <div className="flex h-full min-h-0 gap-0">
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center justify-between px-1 pb-2">
          <SkillViewToggle value={viewMode} onChange={handleViewModeChange} />
        </div>

        {viewMode === 'graph' ? (
          <div className="flex-1 min-h-0">
            <SkillGraphCanvas
              items={items}
              scope={scope}
              selectedSkillId={selectedSkillId}
              onSelectSkill={setSelectedSkillId}
              onUpdateItem={handleUpdateItem}
              onCreateSkill={handleCreateSkill}
            />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-1">
            <SkillListView
              items={items}
              selectedSkillId={selectedSkillId}
              onSelectSkill={setSelectedSkillId}
              onDeleteItem={handleDeleteItem}
              onCreateSkill={handleCreateSkill}
            />
          </div>
        )}
      </div>

      {selectedItem && (
        <div className="w-[380px] shrink-0 border-l overflow-y-auto p-4">
          <ContextItemEditor
            key={selectedItem.id}
            item={selectedItem}
            validationState={validation}
            onUpdate={(patch) => handleUpdateItem(selectedItem.id, patch)}
            onDelete={() => handleDeleteItem(selectedItem.id)}
            onClose={() => setSelectedSkillId(null)}
          />
        </div>
      )}
    </div>
  )
}
