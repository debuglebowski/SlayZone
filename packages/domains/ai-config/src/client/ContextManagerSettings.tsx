import { useCallback, useEffect, useState } from 'react'
import { Plus, Sparkles, Wrench, FolderTree, Server } from 'lucide-react'
import { Button, cn } from '@slayzone/ui'
import type { AiConfigItem, AiConfigItemType, AiConfigScope, UpdateAiConfigItemInput } from '../shared'
import { ContextItemEditor } from './ContextItemEditor'
import { McpServersPanel } from './McpServersPanel'
import { ProjectContextTree } from './ProjectContextTree'

type GlobalSection = 'skill' | 'command' | 'mcp'
type ProjectSection = 'files' | 'mcp'
type Section = GlobalSection | ProjectSection

interface ContextManagerSettingsProps {
  scope: AiConfigScope
  projectId: string | null
  projectPath?: string | null
  projectName?: string
}

function formatTimestamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Recently'
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function ContextManagerSettings({ scope, projectId, projectPath, projectName }: ContextManagerSettingsProps) {
  const defaultSection: Section = scope === 'project' ? 'files' : 'skill'
  const [section, setSection] = useState<Section>(defaultSection)
  const [items, setItems] = useState<AiConfigItem[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const sections: Array<{ key: Section; label: string; icon: typeof Sparkles }> =
    scope === 'project'
      ? [
          { key: 'files', label: 'Context Files', icon: FolderTree },
          { key: 'mcp', label: 'MCP Servers', icon: Server }
        ]
      : [
          { key: 'skill', label: 'Skills', icon: Sparkles },
          { key: 'command', label: 'Commands', icon: Wrench },
          { key: 'mcp', label: 'MCP Servers', icon: Server }
        ]

  const isItemSection = section === 'skill' || section === 'command'

  const loadItems = useCallback(async () => {
    if (!isItemSection) return
    setLoading(true)
    try {
      const rows = await window.api.aiConfig.listItems({
        scope: 'global',
        type: section as AiConfigItemType
      })
      setItems(rows)
    } finally {
      setLoading(false)
    }
  }, [section, isItemSection])

  useEffect(() => {
    void loadItems()
    setEditingId(null)
  }, [loadItems])

  const handleCreate = async () => {
    if (!isItemSection) return
    const type = section as AiConfigItemType
    const defaultContent = type === 'skill'
      ? '---\ndescription: \ntrigger: auto\n---\n\n'
      : '---\ndescription: \nshortcut: \n---\n\n'
    const created = await window.api.aiConfig.createItem({
      type,
      scope: 'global',
      slug: type === 'skill' ? 'new-skill' : 'new-command',
      content: defaultContent
    })
    setItems((prev) => [created, ...prev])
    setEditingId(created.id)
  }

  const handleUpdate = async (itemId: string, patch: Omit<UpdateAiConfigItemInput, 'id'>) => {
    const updated = await window.api.aiConfig.updateItem({ id: itemId, ...patch })
    if (!updated) return
    setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
  }

  const handleDelete = async (itemId: string) => {
    await window.api.aiConfig.deleteItem(itemId)
    setItems((prev) => prev.filter((item) => item.id !== itemId))
    setEditingId(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-1">
          {sections.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSection(key)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                section === key
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {isItemSection && (
          <Button size="sm" onClick={handleCreate}>
            <Plus className="mr-1 size-3.5" />
            New
          </Button>
        )}
      </div>

      {section === 'mcp' ? (
        <McpServersPanel />
      ) : section === 'files' && scope === 'project' && projectPath && projectId ? (
        <ProjectContextTree
          projectPath={projectPath}
          projectId={projectId}
          projectName={projectName}
        />
      ) : isItemSection ? (
        <>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : items.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm text-muted-foreground">
                No {section === 'skill' ? 'skills' : 'commands'} yet.
              </p>
              <Button size="sm" variant="outline" className="mt-2" onClick={handleCreate}>
                <Plus className="mr-1 size-3.5" />
                Create one
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id}>
                  {editingId === item.id ? (
                    <ContextItemEditor
                      item={item}
                      onUpdate={(patch) => handleUpdate(item.id, patch)}
                      onDelete={() => handleDelete(item.id)}
                      onClose={() => setEditingId(null)}
                    />
                  ) : (
                    <button
                      onClick={() => setEditingId(item.id)}
                      className="flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-mono text-sm">{item.slug}</p>
                      </div>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {formatTimestamp(item.updated_at)}
                      </span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
