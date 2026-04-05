import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { Plus } from 'lucide-react'
import { Button } from '@slayzone/ui'
import { SkillGraphCanvas } from './SkillGraphCanvas'
import { SkillListView } from './SkillListView'
import { ContextItemEditor } from './ContextItemEditor'
import { GlobalContextFiles } from './GlobalContextFiles'
import { AddItemPicker } from './AddItemPicker'
import { SkillViewToggle, type SkillViewMode } from './SkillViewToggle'
import { getSkillValidation } from './skill-validation'
import { buildDefaultSkillContent } from '../shared'
import type { AiConfigItem, AiConfigScope, CliProvider, ConfigLevel, UpdateAiConfigItemInput } from '../shared'
import { useContextManagerStore } from './useContextManagerStore'

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

export function SkillsSection({ level, projectId, projectPath }: SkillsSectionProps) {
  const scope: AiConfigScope = level === 'library' ? 'global' : 'project'
  const isProject = level === 'project' && !!projectId && !!projectPath

  const [items, setItems] = useState<AiConfigItem[]>([])
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null)
  const [showAddPicker, setShowAddPicker] = useState(false)
  const [enabledProviders, setEnabledProviders] = useState<CliProvider[]>([])
  const viewMode = (useContextManagerStore((s) => s.skillViewMode[scope]) ?? 'list') as SkillViewMode
  const setSkillViewMode = useContextManagerStore((s) => s.setSkillViewMode)

  const loadItems = useCallback(async () => {
    const rows = await window.api.aiConfig.listItems({
      scope,
      projectId: isProject ? projectId : undefined,
      type: 'skill',
    })
    // Merge linked global items at project level
    if (isProject && projectId && projectPath) {
      const linked = await window.api.aiConfig.getProjectSkillsStatus(projectId, projectPath)
      const ids = new Set(rows.map(r => r.id))
      for (const s of linked) {
        if (!ids.has(s.item.id)) rows.push(s.item)
      }
    }
    setItems(rows)
  }, [scope, isProject, projectId, projectPath])

  useEffect(() => {
    let stale = false
    void loadItems().then(() => { if (stale) return })
    return () => { stale = true }
  }, [loadItems])

  useEffect(() => {
    if (!isProject || !projectId) return
    void window.api.aiConfig.getProjectProviders(projectId).then(setEnabledProviders)
  }, [isProject, projectId])

  const handleViewModeChange = useCallback((mode: SkillViewMode) => {
    setSkillViewMode(scope, mode)
  }, [setSkillViewMode, scope])

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

  const headerTarget = document.getElementById('context-manager-header-actions')
  const editorTarget = document.getElementById('context-manager-editor-panel')
  const handleTarget = document.getElementById('context-manager-resize-handle')

  // Resize drag
  const skillEditorWidth = useContextManagerStore((s) => s.skillEditorWidth)
  const setSkillEditorWidth = useContextManagerStore((s) => s.setSkillEditorWidth)
  const dragging = useRef(false)

  const onDragStart = useCallback((e: ReactMouseEvent) => {
    e.preventDefault()
    dragging.current = true
    const onMove = (ev: globalThis.MouseEvent) => {
      if (!dragging.current) return
      const fromRight = window.innerWidth - ev.clientX - 12 // 12 = p-3 padding
      setSkillEditorWidth(Math.min(Math.max(fromRight, 300), window.innerWidth * 0.6))
    }
    const onUp = () => {
      dragging.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [setSkillEditorWidth])

  // Apply width to editor panel (null = 50% of available)
  useEffect(() => {
    if (editorTarget && selectedItem) {
      editorTarget.style.width = skillEditorWidth ? `${skillEditorWidth}px` : '50%'
    }
    return () => {
      if (editorTarget) editorTarget.style.width = ''
    }
  }, [editorTarget, selectedItem, skillEditorWidth])

  return (
    <>
      {headerTarget && createPortal(
        <div className="flex items-center gap-2">
          <SkillViewToggle value={viewMode} onChange={handleViewModeChange} />
          <Button size="sm" variant="outline" onClick={isProject ? () => setShowAddPicker(true) : handleCreateSkill}>
            <Plus className="mr-1 size-3.5" />
            Add Skill
          </Button>
        </div>,
        headerTarget
      )}
      {selectedItem && handleTarget && createPortal(
        <div
          className="flex h-full w-3 shrink-0 cursor-col-resize items-center justify-center"
          onMouseDown={onDragStart}
          onDoubleClick={() => setSkillEditorWidth(null)}
        >
          <div className="h-8 w-0.5 rounded-full bg-border" />
        </div>,
        handleTarget
      )}
      {selectedItem && editorTarget && createPortal(
        <ContextItemEditor
          key={selectedItem.id}
          item={selectedItem}
          validationState={validation}
          readOnly={isProject && selectedItem.scope === 'global'}
          onUpdate={(patch) => handleUpdateItem(selectedItem.id, patch)}
          onDelete={() => handleDeleteItem(selectedItem.id)}
          onClose={() => setSelectedSkillId(null)}
        />,
        editorTarget
      )}
      <div className="flex h-full min-h-0">
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
            />
          </div>
        )}
      </div>
      {isProject && projectId && projectPath && (
        <AddItemPicker
          open={showAddPicker}
          onOpenChange={setShowAddPicker}
          type="skill"
          projectId={projectId}
          projectPath={projectPath}
          enabledProviders={enabledProviders}
          existingLinks={[]}
          onAdded={() => { setShowAddPicker(false); void loadItems() }}
        />
      )}
    </>
  )
}
