import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import type { Tag } from "../../../../shared/types/database"

interface UserSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function UserSettingsDialog({ open, onOpenChange }: UserSettingsDialogProps) {
  const [tags, setTags] = useState<Tag[]>([])
  const [newTagName, setNewTagName] = useState("")
  const [newTagColor, setNewTagColor] = useState("#6b7280")
  const [editingTag, setEditingTag] = useState<Tag | null>(null)
  const [dbPath, setDbPath] = useState<string>("")

  useEffect(() => {
    if (open) {
      loadData()
    }
  }, [open])

  const loadData = async () => {
    const [loadedTags, path] = await Promise.all([
      window.api.tags.getTags(),
      window.api.settings.get("database_path"),
    ])
    setTags(loadedTags)
    setDbPath(path ?? "Default location (userData)")
  }

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return
    const tag = await window.api.tags.createTag({
      name: newTagName.trim(),
      color: newTagColor,
    })
    setTags([...tags, tag])
    setNewTagName("")
    setNewTagColor("#6b7280")
  }

  const handleUpdateTag = async () => {
    if (!editingTag || !editingTag.name.trim()) return
    const updated = await window.api.tags.updateTag({
      id: editingTag.id,
      name: editingTag.name.trim(),
      color: editingTag.color,
    })
    setTags(tags.map((t) => (t.id === updated.id ? updated : t)))
    setEditingTag(null)
  }

  const handleDeleteTag = async (id: string) => {
    await window.api.tags.deleteTag(id)
    setTags(tags.filter((t) => t.id !== id))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Tags Section */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Tags</Label>

            {/* Existing tags */}
            <div className="space-y-2">
              {tags.map((tag) => (
                <div key={tag.id} className="flex items-center gap-2">
                  {editingTag?.id === tag.id ? (
                    <>
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: editingTag.color }}
                      />
                      <Input
                        value={editingTag.name}
                        onChange={(e) =>
                          setEditingTag({ ...editingTag, name: e.target.value })
                        }
                        className="flex-1 h-8"
                      />
                      <Button size="sm" variant="ghost" onClick={handleUpdateTag}>
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingTag(null)}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="flex-1">{tag.name}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingTag({ ...tag })}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => handleDeleteTag(tag.id)}
                      >
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Add new tag */}
            <div className="flex gap-2 items-end">
              <div className="flex-1 space-y-1">
                <Label htmlFor="new-tag" className="text-xs">
                  New tag
                </Label>
                <Input
                  id="new-tag"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="Tag name"
                  onKeyDown={(e) => e.key === "Enter" && handleCreateTag()}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Color</Label>
                <Input
                  type="color"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  className="w-12 h-9 p-1 cursor-pointer"
                />
              </div>
              <Button onClick={handleCreateTag} disabled={!newTagName.trim()}>
                Add
              </Button>
            </div>
          </div>

          <Separator />

          {/* Database Path Section */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">Database</Label>
            <div className="text-sm text-muted-foreground">
              <p>Location: {dbPath}</p>
              <p className="text-xs mt-1">
                Database path can be changed via command line. Restart required.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
