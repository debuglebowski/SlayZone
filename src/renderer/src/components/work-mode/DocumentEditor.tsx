import { useState, useEffect } from 'react'
import type { WorkspaceItem } from '../../../../shared/types/database'
import { MarkdownEditor } from '@/components/task-detail/MarkdownEditor'

interface Props {
  item: WorkspaceItem
  onUpdate: (item: WorkspaceItem) => void
}

export function DocumentEditor({ item, onUpdate }: Props) {
  const [content, setContent] = useState(item.content ?? '')

  // Reset content when item changes
  useEffect(() => {
    setContent(item.content ?? '')
  }, [item.id, item.content])

  const handleSave = async () => {
    if (content !== item.content) {
      const updated = await window.api.workspaceItems.update({
        id: item.id,
        content
      })
      onUpdate(updated)
    }
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <MarkdownEditor
        value={content}
        onChange={setContent}
        onSave={handleSave}
        placeholder="Start writing..."
      />
    </div>
  )
}
