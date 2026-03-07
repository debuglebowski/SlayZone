import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Input,
  Button,
} from '@slayzone/ui'
import { Plus, Trash2 } from 'lucide-react'
import type { TestLabel } from '../shared/types'

interface LabelManagerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  labels: TestLabel[]
  onLabelsChanged: () => void
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280']

const DEFAULT_STARTER_LABELS = [
  { name: 'Core', color: '#3b82f6' },
  { name: 'Advanced', color: '#8b5cf6' },
  { name: 'Experimental', color: '#f97316' },
]

export function LabelManager({ open, onOpenChange, projectId, labels, onLabelsChanged }: LabelManagerProps): React.JSX.Element {
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (open && labels.length === 0 && !initialized) {
      setInitialized(true)
      ;(async () => {
        for (const starter of DEFAULT_STARTER_LABELS) {
          await window.api.testPanel.createLabel({ project_id: projectId, name: starter.name, color: starter.color })
        }
        onLabelsChanged()
      })()
    }
    if (!open) setInitialized(false)
  }, [open, labels.length, initialized, projectId, onLabelsChanged])

  const addLabel = async () => {
    await window.api.testPanel.createLabel({ project_id: projectId, name: 'New Label' })
    onLabelsChanged()
  }

  const updateLabel = async (id: string, field: string, value: string | number) => {
    await window.api.testPanel.updateLabel({ id, [field]: value })
    onLabelsChanged()
  }

  const deleteLabel = async (id: string) => {
    await window.api.testPanel.deleteLabel(id)
    onLabelsChanged()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Labels</DialogTitle>
          <DialogDescription>Labels for manually categorizing test files by maturity or importance.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-2">
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

          <Button variant="outline" size="sm" className="w-full" onClick={addLabel}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Label
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
