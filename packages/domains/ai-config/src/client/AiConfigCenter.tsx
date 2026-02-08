import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { BookOpen, Bot, CheckCircle2, FileText, FolderTree, Plus, Search, Sparkles, Wrench, type LucideIcon } from 'lucide-react'
import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Separator, Textarea, cn } from '@slayzone/ui'
import type {
  AiConfigItem,
  AiConfigItemType,
  AiConfigProjectSelection,
  AiConfigScope,
  AiConfigSourcePlaceholder,
  UpdateAiConfigItemInput
} from '../shared'

type Section = AiConfigItemType | 'sources'
type ItemFilter = 'all' | 'selected'

interface ProjectLike {
  id: string
  name: string
}

interface AiConfigCenterProps {
  projects: ProjectLike[]
  selectedProjectId: string | null
}

const SECTION_LABELS: Record<Section, string> = {
  skill: 'Skills',
  command: 'Commands',
  doc: 'Docs',
  sources: 'Sources'
}

const SECTION_DESCRIPTIONS: Record<Section, string> = {
  skill: 'Reusable assistant instructions.',
  command: 'Prompt commands and runbooks.',
  doc: 'Shared markdown references.',
  sources: 'External provider placeholders.'
}

const SECTION_ICONS: Record<Section, LucideIcon> = {
  skill: Sparkles,
  command: Wrench,
  doc: BookOpen,
  sources: FolderTree
}

function defaultNameForType(type: AiConfigItemType): string {
  if (type === 'skill') return 'New Skill'
  if (type === 'command') return 'New Command'
  return 'New Doc'
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'untitled'
}

function defaultTargetPath(type: AiConfigItemType, slug: string): string {
  if (type === 'skill') return `.codex/skills/${slug}.md`
  if (type === 'command') return `.codex/commands/${slug}.md`
  return slug.endsWith('.md') ? slug : `${slug}.md`
}

function formatTimestamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Recently updated'
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

export function AiConfigCenter({ projects, selectedProjectId }: AiConfigCenterProps): React.JSX.Element {
  const [scope, setScope] = useState<AiConfigScope>('global')
  const [section, setSection] = useState<Section>('skill')
  const [projectId, setProjectId] = useState<string | null>(selectedProjectId)
  const [items, setItems] = useState<AiConfigItem[]>([])
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [selections, setSelections] = useState<AiConfigProjectSelection[]>([])
  const [targetPath, setTargetPath] = useState('')
  const [sources, setSources] = useState<AiConfigSourcePlaceholder[]>([])
  const [sectionCounts, setSectionCounts] = useState<Record<AiConfigItemType, number>>({
    skill: 0,
    command: 0,
    doc: 0
  })
  const [query, setQuery] = useState('')
  const [listFilter, setListFilter] = useState<ItemFilter>('all')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === projectId) ?? null,
    [projects, projectId]
  )

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) ?? null,
    [items, selectedItemId]
  )

  const projectSelection = useMemo(() => {
    if (!projectId || !selectedItemId) return null
    return selections.find((row) => row.project_id === projectId && row.item_id === selectedItemId) ?? null
  }, [selections, projectId, selectedItemId])

  const selectedItemIds = useMemo(() => new Set(selections.map((row) => row.item_id)), [selections])

  const searchedItems = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return items
    return items.filter((item) => {
      return item.name.toLowerCase().includes(normalized) || item.slug.toLowerCase().includes(normalized)
    })
  }, [items, query])

  const visibleItems = useMemo(() => {
    if (listFilter === 'selected') return searchedItems.filter((item) => selectedItemIds.has(item.id))
    return searchedItems
  }, [listFilter, searchedItems, selectedItemIds])

  const loadItems = useCallback(async () => {
    if (section === 'sources') return
    setLoading(true)
    try {
      const rows = await window.api.aiConfig.listItems({
        scope,
        projectId: scope === 'project' ? projectId : null,
        type: section
      })
      setItems(rows)
      if (!rows.some((row) => row.id === selectedItemId)) {
        setSelectedItemId(rows[0]?.id ?? null)
      }
    } finally {
      setLoading(false)
    }
  }, [projectId, scope, section, selectedItemId])

  const loadSelections = useCallback(async () => {
    if (!projectId) {
      setSelections([])
      return
    }
    const rows = await window.api.aiConfig.listProjectSelections(projectId)
    setSelections(rows)
  }, [projectId])

  const loadSources = useCallback(async () => {
    const rows = await window.api.aiConfig.listSources()
    setSources(rows)
  }, [])

  const loadSectionCounts = useCallback(async () => {
    const projectInput = scope === 'project' ? projectId : null
    const [skills, commands, docs] = await Promise.all([
      window.api.aiConfig.listItems({ scope, projectId: projectInput, type: 'skill' }),
      window.api.aiConfig.listItems({ scope, projectId: projectInput, type: 'command' }),
      window.api.aiConfig.listItems({ scope, projectId: projectInput, type: 'doc' })
    ])

    setSectionCounts({
      skill: skills.length,
      command: commands.length,
      doc: docs.length
    })
  }, [scope, projectId])

  useEffect(() => {
    if (section === 'sources') {
      void loadSources()
    } else {
      void loadItems()
    }
  }, [loadItems, loadSources, section])

  useEffect(() => {
    void loadSelections()
  }, [loadSelections])

  useEffect(() => {
    void loadSectionCounts()
  }, [loadSectionCounts])

  useEffect(() => {
    if (!selectedItem) {
      setTargetPath('')
      return
    }
    if (projectSelection) {
      setTargetPath(projectSelection.target_path)
      return
    }
    setTargetPath(defaultTargetPath(selectedItem.type, selectedItem.slug))
  }, [projectSelection, selectedItem])

  useEffect(() => {
    if (!visibleItems.some((item) => item.id === selectedItemId)) {
      setSelectedItemId(visibleItems[0]?.id ?? null)
    }
  }, [visibleItems, selectedItemId])

  const updateSelected = async (patch: Omit<UpdateAiConfigItemInput, 'id'>): Promise<void> => {
    if (!selectedItem) return
    setSaving(true)
    try {
      const updated = await window.api.aiConfig.updateItem({
        id: selectedItem.id,
        ...patch
      })
      if (!updated) return
      setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
    } finally {
      setSaving(false)
    }
  }

  const saveNow = async (): Promise<void> => {
    if (!selectedItem) return
    await updateSelected({
      name: selectedItem.name,
      slug: slugify(selectedItem.slug),
      content: selectedItem.content,
      metadataJson: selectedItem.metadata_json
    })
  }

  const handleCreate = async (): Promise<void> => {
    if (section === 'sources') return
    const type = section
    const created = await window.api.aiConfig.createItem({
      type,
      scope,
      projectId: scope === 'project' ? projectId : null,
      name: defaultNameForType(type),
      slug: `new-${type}-${Date.now().toString().slice(-5)}`,
      content: '',
      metadataJson: '{}'
    })
    setItems((prev) => [created, ...prev])
    setSelectedItemId(created.id)
    setSectionCounts((prev) => ({ ...prev, [type]: prev[type] + 1 }))
  }

  const handleDelete = async (): Promise<void> => {
    if (!selectedItem) return
    await window.api.aiConfig.deleteItem(selectedItem.id)
    setItems((prev) => prev.filter((item) => item.id !== selectedItem.id))
    setSelectedItemId((prev) => (prev === selectedItem.id ? null : prev))
    setSectionCounts((prev) => ({
      ...prev,
      [selectedItem.type]: Math.max(0, prev[selectedItem.type] - 1)
    }))
  }

  const toggleProjectSelection = async (): Promise<void> => {
    if (!projectId || !selectedItem) return
    if (projectSelection) {
      await window.api.aiConfig.removeProjectSelection(projectId, selectedItem.id)
      await loadSelections()
      return
    }

    await window.api.aiConfig.setProjectSelection({
      projectId,
      itemId: selectedItem.id,
      targetPath: targetPath.trim() || defaultTargetPath(selectedItem.type, selectedItem.slug)
    })
    await loadSelections()
  }

  const SectionIcon = SECTION_ICONS[section]

  const selectionCount = selections.length

  return (
    <div className="h-full min-h-0 bg-gradient-to-b from-background via-background to-muted/20 p-4 md:p-6">
      <div className="window-no-drag h-full min-h-0 flex flex-col gap-3">
        <header className="rounded-xl border bg-card/95 px-4 py-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Bot className="text-primary size-4.5" />
                <h1 className="truncate text-lg font-semibold tracking-tight md:text-xl">AI Config Center V2</h1>
              </div>
              <p className="mt-1 text-xs text-muted-foreground md:text-sm">
                Build and govern reusable AI building blocks across projects.
              </p>
            </div>
            <div className="grid min-w-[280px] grid-cols-1 gap-2 sm:min-w-[420px] sm:grid-cols-[1fr_110px_160px]">
              <div className="relative">
                <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  className="pl-9"
                  placeholder="Search items..."
                  value={query}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
                />
              </div>
              <Select value={scope} onValueChange={(value: string) => setScope(value as AiConfigScope)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global</SelectItem>
                  <SelectItem value="project">Project</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={projectId ?? ''}
                onValueChange={(value: string) => setProjectId(value)}
                disabled={projects.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </header>

        <div className="flex-1 min-h-0 grid grid-cols-1 gap-3 lg:grid-cols-12">
          <aside className="min-h-0 rounded-xl border bg-card/95 p-3 shadow-sm lg:col-span-2">
            <p className="px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Libraries</p>
            <div className="mt-2 space-y-1.5">
              {(['skill', 'command', 'doc', 'sources'] as Section[]).map((key) => {
                const Icon = SECTION_ICONS[key]
                const isActive = section === key
                const count = key === 'sources' ? sources.length : sectionCounts[key]
                return (
                  <button
                    key={key}
                    onClick={() => setSection(key)}
                    className={cn(
                      'w-full rounded-lg border px-2.5 py-2 text-left transition-colors',
                      isActive
                        ? 'border-primary bg-primary/10'
                        : 'border-transparent bg-muted/30 hover:border-border hover:bg-muted/50'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Icon className={cn('size-3.5', isActive ? 'text-primary' : 'text-muted-foreground')} />
                        <p className="text-sm font-medium">{SECTION_LABELS[key]}</p>
                      </div>
                      <span className="rounded-md border px-1.5 py-0.5 text-[11px] text-muted-foreground">{count}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">{SECTION_DESCRIPTIONS[key]}</p>
                  </button>
                )
              })}
            </div>

            <Separator className="my-3" />

            <div className="space-y-2 rounded-lg border bg-muted/25 p-2.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Scope</p>
              <p className="text-xs">{scope === 'global' ? 'Global Library' : 'Project Library'}</p>
              <p className="text-[11px] text-muted-foreground">
                {scope === 'global'
                  ? 'Shared by all projects. Injection is explicit per project.'
                  : 'Only project-local items are shown.'}
              </p>
            </div>

            <div className="mt-2 space-y-2 rounded-lg border bg-muted/25 p-2.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Project Context</p>
              <p className="truncate text-xs">{selectedProject?.name ?? 'No project selected'}</p>
              <p className="text-[11px] text-muted-foreground">{selectionCount} selected for injection</p>
            </div>
          </aside>

          <section className="min-h-0 rounded-xl border bg-card/95 p-3 shadow-sm lg:col-span-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <SectionIcon className="text-primary size-4" />
                <p className="text-sm font-semibold">{SECTION_LABELS[section]} Library</p>
              </div>
              <Button size="sm" onClick={handleCreate} disabled={section === 'sources'}>
                <Plus className="mr-1 size-3.5" />
                New
              </Button>
            </div>

            <div className="mb-2 flex flex-wrap items-center gap-2">
              <button
                onClick={() => setListFilter('all')}
                className={cn(
                  'rounded-md border px-2 py-1 text-xs',
                  listFilter === 'all' ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground'
                )}
              >
                All
              </button>
              <button
                onClick={() => setListFilter('selected')}
                className={cn(
                  'rounded-md border px-2 py-1 text-xs',
                  listFilter === 'selected' ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground'
                )}
                disabled={!projectId}
              >
                Selected for Project
              </button>
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : section === 'sources' ? (
              <div className="h-[calc(100%-4.5rem)] overflow-auto space-y-2 pr-1">
                {sources.map((source) => (
                  <button key={source.id} className="w-full rounded-lg border bg-background/60 p-3 text-left">
                    <p className="text-sm font-medium">{source.name}</p>
                    <p className="text-xs text-muted-foreground">{source.kind} · {source.status}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Last checked {source.last_checked_at ? formatTimestamp(source.last_checked_at) : 'never'}
                    </p>
                  </button>
                ))}
                {sources.length === 0 && (
                  <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">No source placeholders yet.</div>
                )}
              </div>
            ) : (
              <div className="h-[calc(100%-4.5rem)] overflow-auto space-y-2 pr-1">
                {visibleItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedItemId(item.id)}
                    className={cn(
                      'w-full rounded-lg border p-3 text-left transition-colors',
                      selectedItemId === item.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border/70 bg-background/60 hover:bg-muted/45'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      {selectedItemIds.has(item.id) && <span className="text-[11px] text-primary">Selected</span>}
                    </div>
                    <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{item.slug}</p>
                    <p className="mt-2 text-[11px] text-muted-foreground">Updated {formatTimestamp(item.updated_at)}</p>
                  </button>
                ))}
                {visibleItems.length === 0 && (
                  <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                    No items in this filter.
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="min-h-0 overflow-auto rounded-xl border bg-card/95 p-4 shadow-sm lg:col-span-7">
            {section === 'sources' ? (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Source Inspector</h2>
                <p className="text-sm text-muted-foreground">
                  Federation is disabled in v1. This panel will host source configuration and sync controls.
                </p>
                <div className="flex items-center gap-2">
                  <Button disabled>Add Source</Button>
                  <Button variant="outline" disabled>Search Sources</Button>
                </div>
              </div>
            ) : !selectedItem ? (
              <div className="flex h-full min-h-64 items-center justify-center rounded-xl border border-dashed bg-muted/20 p-6">
                <div className="text-center">
                  <FileText className="mx-auto mb-2 size-6 text-muted-foreground" />
                  <p className="text-sm font-medium">Select an item to edit</p>
                  <p className="text-xs text-muted-foreground">Choose from the middle panel to open the editor.</p>
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-4xl space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Name</Label>
                    <Input
                      value={selectedItem.name}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => {
                        const name = e.target.value
                        setItems((prev) => prev.map((item) => (
                          item.id === selectedItem.id ? { ...item, name } : item
                        )))
                      }}
                      onBlur={() => updateSelected({ name: selectedItem.name })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Slug / Filename</Label>
                    <Input
                      value={selectedItem.slug}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => {
                        const slug = e.target.value
                        setItems((prev) => prev.map((item) => (
                          item.id === selectedItem.id ? { ...item, slug } : item
                        )))
                      }}
                      onBlur={() => updateSelected({ slug: slugify(selectedItem.slug) })}
                    />
                  </div>
                </div>

                <div className="rounded-xl border bg-background/60 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Label>Content</Label>
                    <p className="text-[11px] text-muted-foreground">Markdown / prompt body</p>
                  </div>
                  <Textarea
                    className="min-h-72 font-mono text-sm"
                    value={selectedItem.content}
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
                      const content = e.target.value
                      setItems((prev) => prev.map((item) => (
                        item.id === selectedItem.id ? { ...item, content } : item
                      )))
                    }}
                    onBlur={() => updateSelected({ content: selectedItem.content })}
                  />
                </div>

                <div className="rounded-xl border bg-background/60 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Label>Metadata JSON</Label>
                    <p className="text-[11px] text-muted-foreground">Optional machine-readable config</p>
                  </div>
                  <Textarea
                    className="min-h-28 font-mono text-sm"
                    value={selectedItem.metadata_json}
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
                      const metadata_json = e.target.value
                      setItems((prev) => prev.map((item) => (
                        item.id === selectedItem.id ? { ...item, metadata_json } : item
                      )))
                    }}
                    onBlur={() => updateSelected({ metadataJson: selectedItem.metadata_json })}
                  />
                </div>

                <div className="rounded-xl border bg-muted/25 p-3 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">Injection Plan</p>
                      <p className="text-xs text-muted-foreground">Project selection is explicit. No inheritance.</p>
                    </div>
                    <span className={cn(
                      'rounded-full border px-2 py-0.5 text-xs',
                      projectSelection ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'
                    )}>
                      {projectSelection ? 'Selected' : 'Not selected'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      value={targetPath}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setTargetPath(e.target.value)}
                      placeholder=".codex/skills/my-skill.md"
                      disabled={!selectedProject}
                    />
                    <Button onClick={toggleProjectSelection} disabled={!selectedProject}>
                      {projectSelection ? 'Unselect' : 'Select for project'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Project: {selectedProject?.name ?? 'Choose a project first'}</p>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs text-muted-foreground">
                    Last updated {formatTimestamp(selectedItem.updated_at)}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => void saveNow()} disabled={saving}>Save</Button>
                    <Button variant="destructive" onClick={handleDelete}>Delete</Button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>

        <footer className="flex items-center justify-between gap-2 rounded-xl border bg-card/95 px-3 py-2 text-xs text-muted-foreground shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className={cn('size-3.5', saving ? 'text-muted-foreground' : 'text-primary')} />
            <span>{saving ? 'Saving...' : 'Autosave on blur'}</span>
            <span>•</span>
            <span>{selectedItem ? `Last saved ${formatTimestamp(selectedItem.updated_at)}` : 'No item selected'}</span>
          </div>
          <span>
            Validation: <span className="text-foreground">OK</span>
          </span>
        </footer>
      </div>
    </div>
  )
}
