import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Input,
  Button,
  Separator,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@slayzone/ui'
import { Plus, Trash2, Save } from 'lucide-react'
import type { TestCategory, TestProfile, CreateTestCategoryInput, TestLabel } from '../shared/types'

type GroupBy = 'none' | 'path' | 'label'

interface TestsTabProps {
  projectId: string
  groupBy: GroupBy
  onGroupByChange: (value: GroupBy) => void
}

const CUSTOM_VALUE = '__custom__'
const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280']

function matchProfile(categories: TestCategory[], profiles: TestProfile[]): string {
  for (const p of profiles) {
    if (p.categories.length !== categories.length) continue
    const match = p.categories.every((pc, i) =>
      categories[i] && pc.name === categories[i].name && pc.pattern === categories[i].pattern && pc.color === categories[i].color
    )
    if (match) return p.id
  }
  return CUSTOM_VALUE
}

export function TestsTab({ projectId, groupBy, onGroupByChange }: TestsTabProps): React.JSX.Element {
  const [profiles, setProfiles] = useState<TestProfile[]>([])
  const [categories, setCategories] = useState<TestCategory[]>([])
  const [labels, setLabels] = useState<TestLabel[]>([])

  const reload = useCallback(async () => {
    const [cats, lbls, profs] = await Promise.all([
      window.api.testPanel.getCategories(projectId),
      window.api.testPanel.getLabels(projectId),
      window.api.testPanel.getProfiles()
    ])
    setCategories(cats)
    setLabels(lbls)
    setProfiles(profs)
  }, [projectId])

  useEffect(() => { reload() }, [reload])

  const selectedProfile = matchProfile(categories, profiles)

  const handleProfileChange = async (value: string) => {
    if (value !== CUSTOM_VALUE && value !== '') {
      await window.api.testPanel.applyProfile(projectId, value)
      reload()
    }
  }

  const addCategory = async () => {
    const input: CreateTestCategoryInput = {
      project_id: projectId,
      name: 'New Category',
      pattern: '**/*.test.ts'
    }
    await window.api.testPanel.createCategory(input)
    reload()
  }

  const categoryIdsRef = useRef(new Set<string>())
  useEffect(() => {
    categoryIdsRef.current = new Set(categories.map((c) => c.id))
  }, [categories])

  const updateCategory = async (id: string, field: string, value: string | number) => {
    if (!categoryIdsRef.current.has(id)) return
    await window.api.testPanel.updateCategory({ id, [field]: value })
    reload()
  }

  const deleteCategory = async (id: string) => {
    await window.api.testPanel.deleteCategory(id)
    reload()
  }

  const saveAsProfile = async () => {
    const name = prompt('Profile name:')
    if (!name?.trim()) return
    const profile: TestProfile = {
      id: crypto.randomUUID(),
      name: name.trim(),
      categories: categories.map((c) => ({ name: c.name, pattern: c.pattern, color: c.color }))
    }
    await window.api.testPanel.saveProfile(profile)
    setProfiles(await window.api.testPanel.getProfiles())
  }

  const deleteProfile = async (id: string) => {
    await window.api.testPanel.deleteProfile(id)
    setProfiles(await window.api.testPanel.getProfiles())
  }

  const addLabel = async () => {
    await window.api.testPanel.createLabel({ project_id: projectId, name: 'New Label' })
    reload()
  }

  const updateLabel = async (id: string, field: string, value: string | number) => {
    await window.api.testPanel.updateLabel({ id, [field]: value })
    reload()
  }

  const deleteLabel = async (id: string) => {
    await window.api.testPanel.deleteLabel(id)
    reload()
  }

  const builtinProfiles = profiles.filter((p) => p.id.startsWith('builtin:'))
  const userProfiles = profiles.filter((p) => !p.id.startsWith('builtin:'))

  return (
    <div className="space-y-6">
      {/* Group by */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Group by</label>
        <Select value={groupBy} onValueChange={(v) => onGroupByChange(v as GroupBy)}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="path">File path</SelectItem>
            <SelectItem value="label">Labels</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator />

      <div className="grid grid-cols-2 gap-16">
        {/* Categories */}
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-medium">Categories</h3>
            <p className="text-xs text-muted-foreground">Glob patterns to discover test files.</p>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Profile</label>
            <div className="flex items-center gap-2">
            <Select value={selectedProfile} onValueChange={handleProfileChange}>
              <SelectTrigger className="h-8 text-sm flex-1">
                <SelectValue placeholder="Select a profile..." />
              </SelectTrigger>
              <SelectContent>
                {builtinProfiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — {p.categories.map((c) => c.name).join(', ')}
                  </SelectItem>
                ))}
                {userProfiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — {p.categories.map((c) => c.name).join(', ')}
                  </SelectItem>
                ))}
                <SelectItem value={CUSTOM_VALUE}>Custom</SelectItem>
              </SelectContent>
            </Select>
            {userProfiles.some((p) => p.id === selectedProfile) && (
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => deleteProfile(selectedProfile)} title="Delete profile">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
            {categories.length > 0 && selectedProfile === CUSTOM_VALUE && (
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={saveAsProfile} title="Save as profile">
                <Save className="h-3.5 w-3.5" />
              </Button>
            )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Patterns</label>
            <div className="space-y-3">
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center gap-2">
                <button
                  className="h-6 w-6 rounded-full border border-border shrink-0"
                  style={{ backgroundColor: cat.color }}
                  onClick={() => {
                    const idx = COLORS.indexOf(cat.color)
                    updateCategory(cat.id, 'color', COLORS[(idx + 1) % COLORS.length])
                  }}
                />
                <Input
                  className="h-8 text-sm flex-1"
                  defaultValue={cat.name}
                  placeholder="Name"
                  onBlur={(e) => {
                    if (e.target.value !== cat.name) updateCategory(cat.id, 'name', e.target.value)
                  }}
                />
                <Input
                  className="h-8 text-sm flex-1 font-mono"
                  defaultValue={cat.pattern}
                  placeholder="e.g. **/*.test.ts"
                  onBlur={(e) => {
                    if (e.target.value !== cat.pattern) updateCategory(cat.id, 'pattern', e.target.value)
                  }}
                />
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => deleteCategory(cat.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}

            <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors" onClick={addCategory}>
              <Plus className="h-3 w-3" /> Add category
            </button>
          </div>
          </div>

        </div>

        {/* Labels */}
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-medium">Labels</h3>
            <p className="text-xs text-muted-foreground">Manually tag test files.</p>
          </div>

          <div className="space-y-3">
            {labels.map((label) => (
              <div key={label.id} className="flex items-center gap-2">
                <button
                  className="h-6 w-6 rounded-full border border-border shrink-0"
                  style={{ backgroundColor: label.color }}
                  onClick={() => {
                    const idx = COLORS.indexOf(label.color)
                    updateLabel(label.id, 'color', COLORS[(idx + 1) % COLORS.length])
                  }}
                />
                <Input
                  className="h-8 text-sm flex-1"
                  defaultValue={label.name}
                  placeholder="Label name"
                  onBlur={(e) => {
                    if (e.target.value !== label.name) updateLabel(label.id, 'name', e.target.value)
                  }}
                />
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => deleteLabel(label.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}

            <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors" onClick={addLabel}>
              <Plus className="h-3 w-3" /> Add label
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
