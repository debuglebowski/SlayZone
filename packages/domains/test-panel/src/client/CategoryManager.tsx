import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import type { TestCategory, TestProfile, CreateTestCategoryInput } from '../shared/types'

interface CategoryManagerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  categories: TestCategory[]
  onCategoriesChanged: () => void
  onPatternsChanged: () => void
}

const CUSTOM_VALUE = '__custom__'

export function CategoryManager({ open, onOpenChange, projectId, categories, onCategoriesChanged, onPatternsChanged }: CategoryManagerProps): React.JSX.Element {
  const [profiles, setProfiles] = useState<TestProfile[]>([])
  const [selectedProfile, setSelectedProfile] = useState<string>(CUSTOM_VALUE)
  const [profileName, setProfileName] = useState('')

  useEffect(() => {
    if (open) {
      window.api.testPanel.getProfiles().then(setProfiles)
      setSelectedProfile(CUSTOM_VALUE)
    }
  }, [open])

  const handleProfileChange = async (value: string) => {
    setSelectedProfile(value)
    if (value !== CUSTOM_VALUE && value !== '') {
      await window.api.testPanel.applyProfile(projectId, value)
      onPatternsChanged()
    }
  }

  const addCategory = async () => {
    const input: CreateTestCategoryInput = {
      project_id: projectId,
      name: 'New Category',
      pattern: '**/*.test.ts'
    }
    await window.api.testPanel.createCategory(input)
    setSelectedProfile(CUSTOM_VALUE)
    onPatternsChanged()
  }

  const updateCategory = async (id: string, field: string, value: string | number) => {
    await window.api.testPanel.updateCategory({ id, [field]: value })
    setSelectedProfile(CUSTOM_VALUE)
    if (field === 'pattern') onPatternsChanged()
    else onCategoriesChanged()
  }

  const deleteCategory = async (id: string) => {
    await window.api.testPanel.deleteCategory(id)
    setSelectedProfile(CUSTOM_VALUE)
    onPatternsChanged()
  }

  const saveAsProfile = async () => {
    if (!profileName.trim()) return
    const profile: TestProfile = {
      id: crypto.randomUUID(),
      name: profileName.trim(),
      categories: categories.map((c) => ({ name: c.name, pattern: c.pattern, color: c.color }))
    }
    await window.api.testPanel.saveProfile(profile)
    setProfiles(await window.api.testPanel.getProfiles())
    setProfileName('')
  }

  const deleteProfile = async (id: string) => {
    await window.api.testPanel.deleteProfile(id)
    setProfiles(await window.api.testPanel.getProfiles())
    if (selectedProfile === id) setSelectedProfile(CUSTOM_VALUE)
  }

  const builtinProfiles = profiles.filter((p) => p.id.startsWith('builtin:'))
  const userProfiles = profiles.filter((p) => !p.id.startsWith('builtin:'))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Test Categories</DialogTitle>
          <DialogDescription>Choose a profile or customize glob patterns to categorize test files.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
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
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => deleteProfile(selectedProfile)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          {selectedProfile === CUSTOM_VALUE && (
            <>
              <Separator />

              <div className="space-y-3">
                {categories.map((cat) => (
                  <div key={cat.id} className="flex items-center gap-2">
                    <button
                      className="h-6 w-6 rounded-full border border-border shrink-0"
                      style={{ backgroundColor: cat.color }}
                      onClick={() => {
                        const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280']
                        const idx = colors.indexOf(cat.color)
                        updateCategory(cat.id, 'color', colors[(idx + 1) % colors.length])
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

                <Button variant="outline" size="sm" className="w-full" onClick={addCategory}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Category
                </Button>
              </div>

              {categories.length > 0 && (
                <>
                  <Separator />
                  <div className="flex items-center gap-2">
                    <Input
                      className="h-8 text-sm flex-1"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      placeholder="Save as profile..."
                      onKeyDown={(e) => { if (e.key === 'Enter') saveAsProfile() }}
                    />
                    <Button variant="outline" size="sm" onClick={saveAsProfile} disabled={!profileName.trim()}>
                      <Save className="h-3.5 w-3.5 mr-1" /> Save
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
