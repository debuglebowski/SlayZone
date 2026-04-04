import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, FileText, FolderTree, Server, Sparkles } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, cn } from '@slayzone/ui'
import { SkillGraphCanvas } from './SkillGraphCanvas'
import { ContextItemEditor } from './ContextItemEditor'
import { ProjectInstructions } from './ProjectInstructions'
import { McpServersPanel } from './McpServersPanel'
import { ProjectContextFilesView } from './ProjectContextFilesView'
import { GlobalContextFiles } from './GlobalContextFiles'
import { getSkillValidation } from './skill-validation'
import { buildDefaultSkillContent } from '../shared'
import type { AiConfigItem, AiConfigScope, UpdateAiConfigItemInput } from '../shared'

interface ContextManagerPageProps {
  selectedProjectId: string
  projectPath?: string | null
  projectName?: string
  onBack: () => void
  variant?: 'standalone' | 'panel'
}

type Section = 'skills' | 'instructions' | 'mcp' | 'files'

const NAV_ITEMS: { id: Section; label: string; icon: typeof Sparkles }[] = [
  { id: 'skills', label: 'Skills', icon: Sparkles },
  { id: 'instructions', label: 'Instructions', icon: FileText },
  { id: 'mcp', label: 'MCP', icon: Server },
  { id: 'files', label: 'Files', icon: FolderTree },
]

function nextAvailableSlug(base: string, existingSlugs: Set<string>): string {
  if (!existingSlugs.has(base)) return base
  let i = 2
  while (existingSlugs.has(`${base}-${i}`)) i += 1
  return `${base}-${i}`
}

export function ContextManagerPage({
  selectedProjectId,
  projectPath,
  projectName,
  onBack,
  variant = 'standalone',
}: ContextManagerPageProps) {
  const isPanel = variant === 'panel'
  const hasProject = !!selectedProjectId && !!projectPath
  const [scope, setScope] = useState<AiConfigScope>(hasProject ? 'project' : 'global')
  const [section, setSection] = useState<Section>('skills')
  const [items, setItems] = useState<AiConfigItem[]>([])
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  const isProject = scope === 'project' && hasProject

  useEffect(() => {
    let stale = false
    void (async () => {
      const rows = await window.api.aiConfig.listItems({
        scope,
        projectId: isProject ? selectedProjectId : undefined,
        type: 'skill',
      })
      if (!stale) setItems(rows)
    })()
    return () => { stale = true }
  }, [scope, isProject, selectedProjectId, version])

  const selectedItem = items.find(i => i.id === selectedSkillId) ?? null

  const handleUpdateItem = useCallback(async (id: string, patch: Omit<UpdateAiConfigItemInput, 'id'>) => {
    const updated = await window.api.aiConfig.updateItem({ id, ...patch })
    if (updated) {
      setItems(prev => prev.map(i => i.id === updated.id ? updated : i))
    }
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
      projectId: isProject ? selectedProjectId : undefined,
      slug,
      content: buildDefaultSkillContent(slug),
    })
    setItems(prev => [created, ...prev])
    setSelectedSkillId(created.id)
  }, [items, scope, isProject, selectedProjectId])

  const validation = selectedItem ? getSkillValidation(selectedItem) : null

  return (
    <div className={cn('flex h-full flex-col', isPanel ? '' : 'bg-surface-0')}>
      {/* Header */}
      {isPanel ? (
        <div className="shrink-0 h-10 px-2 border-b border-border bg-surface-1 flex items-center gap-1">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { setSection(id); if (id !== 'skills') setSelectedSkillId(null) }}
              className={cn(
                'flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs font-medium transition-colors',
                section === id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
          {hasProject && (
            <Tabs
              value={scope}
              onValueChange={(v) => { setScope(v as AiConfigScope); setSelectedSkillId(null) }}
              className="ml-auto"
            >
              <TabsList className="h-7">
                <TabsTrigger value="project" className="text-xs px-2 h-6">
                  {projectName ?? 'Project'}
                </TabsTrigger>
                <TabsTrigger value="global" className="text-xs px-2 h-6">
                  Global
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        </div>
      ) : (
        <header className="flex shrink-0 items-center gap-4 border-b px-4 py-2.5">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
          </button>
          <h1 className="text-base font-semibold">Context Manager</h1>
          {hasProject && (
            <Tabs
              value={scope}
              onValueChange={(v) => { setScope(v as AiConfigScope); setSelectedSkillId(null) }}
              className="ml-auto"
            >
              <TabsList className="h-8">
                <TabsTrigger value="project" className="text-xs px-3">
                  {projectName ?? 'Project'}
                </TabsTrigger>
                <TabsTrigger value="global" className="text-xs px-3">
                  Global
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        </header>
      )}

      <div className="flex flex-1 min-h-0">
        {/* Left nav sidebar — standalone only */}
        {!isPanel && (
          <nav className="w-56 shrink-0 border-r border-border/50 p-3 space-y-1.5">
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => { setSection(id); if (id !== 'skills') setSelectedSkillId(null) }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm transition-colors',
                  section === id
                    ? 'bg-surface-2 font-medium text-foreground ring-1 ring-border'
                    : 'text-muted-foreground hover:bg-surface-1 hover:text-foreground'
                )}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </nav>
        )}

        {/* Main content area */}
        {section === 'skills' && (
          <div className="flex flex-1 min-h-0 min-w-0">
            <div className="flex-1 min-w-0">
              <SkillGraphCanvas
                items={items}
                scope={scope}
                selectedSkillId={selectedSkillId}
                onSelectSkill={setSelectedSkillId}
                onUpdateItem={handleUpdateItem}
                onCreateSkill={handleCreateSkill}
              />
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
        )}

        {section === 'instructions' && (
          <div className={cn('flex-1 overflow-y-auto', isPanel ? 'p-3' : 'p-6')}>
            <div className={cn('w-full', !isPanel && 'mx-auto max-w-5xl')}>
              <ProjectInstructions
                projectId={isProject ? selectedProjectId : null}
                projectPath={isProject ? projectPath : null}
                onChanged={() => setVersion(v => v + 1)}
              />
            </div>
          </div>
        )}

        {section === 'mcp' && (
          <div className={cn('flex-1 overflow-y-auto', isPanel ? 'p-3' : 'p-6')}>
            <McpServersPanel
              mode={isProject ? 'project' : 'global'}
              projectPath={isProject ? projectPath! : undefined}
              projectId={isProject ? selectedProjectId : undefined}
            />
          </div>
        )}

        {section === 'files' && (
          <div className={cn('flex flex-1 min-h-0', isPanel ? 'p-2' : 'p-4')}>
            {isProject
              ? <ProjectContextFilesView projectPath={projectPath!} projectId={selectedProjectId} />
              : <GlobalContextFiles />
            }
          </div>
        )}
      </div>
    </div>
  )
}
