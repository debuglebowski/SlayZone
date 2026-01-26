import { useEffect, useState } from 'react'
import type { Task } from '../../../shared/types/database'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { usePty } from '@/contexts/PtyContext'

interface QuickRunDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (task: Task) => void
  defaultProjectId: string
}

export function QuickRunDialog({
  open,
  onOpenChange,
  onCreated,
  defaultProjectId
}: QuickRunDialogProps): React.JSX.Element {
  const [prompt, setPrompt] = useState('')
  const { setQuickRunPrompt } = usePty()

  // Reset prompt when dialog opens
  useEffect(() => {
    if (open) {
      setPrompt('')
    }
  }, [open])

  const handleSubmit = async (): Promise<void> => {
    if (!prompt.trim()) return

    const task = await window.api.db.createTask({
      projectId: defaultProjectId,
      title: prompt.trim(),
      description: '',
      status: 'in_progress'
    })

    setQuickRunPrompt(task.id, prompt.trim())
    onCreated(task)
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && e.metaKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[500px]"
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          const textarea = document.querySelector<HTMLTextAreaElement>('[data-quick-run-input]')
          textarea?.focus()
        }}
      >
        <DialogHeader>
          <DialogTitle>Quick Run</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Textarea
            data-quick-run-input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter prompt..."
            className="min-h-[120px]"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!prompt.trim()}>
              Run
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
