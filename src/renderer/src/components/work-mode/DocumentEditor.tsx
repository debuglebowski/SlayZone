import { useState, useEffect } from 'react'
import type { WorkspaceItem } from '../../../../shared/types/database'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { EditableTitle } from './EditableTitle'
import { Expand, Shrink } from 'lucide-react'

interface Props {
  item: WorkspaceItem
  onUpdate: (item: WorkspaceItem) => void
}

const WIDTH_MODE_KEY = 'document-width-mode'

export function DocumentEditor({ item, onUpdate }: Props) {
  const [content, setContent] = useState(item.content ?? '')
  const [isWide, setIsWide] = useState(() => {
    return localStorage.getItem(WIDTH_MODE_KEY) !== 'narrow'
  })

  const toggleWidth = () => {
    const newIsWide = !isWide
    setIsWide(newIsWide)
    localStorage.setItem(WIDTH_MODE_KEY, newIsWide ? 'wide' : 'narrow')
  }

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

  const handleRename = async (name: string) => {
    const updated = await window.api.workspaceItems.update({
      id: item.id,
      name
    })
    onUpdate(updated)
  }

  return (
    <div className="h-full flex flex-col p-4 pt-16 relative">
      <button
        onClick={toggleWidth}
        className="absolute top-4 right-4 p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
        title={isWide ? 'Narrow mode' : 'Wide mode'}
      >
        {isWide ? <Shrink size={16} /> : <Expand size={16} />}
      </button>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div
          className="mx-auto"
          style={{
            maxWidth: isWide ? '100%' : '65ch',
            transition: 'max-width 300ms ease-in-out'
          }}
        >
          <div className="mb-6">
            <EditableTitle
              value={item.name}
              onChange={handleRename}
              className="text-4xl font-bold"
            />
          </div>
          <RichTextEditor
            value={content}
            onChange={setContent}
            onBlur={handleSave}
            placeholder="Start writing..."
            className="h-full"
          />
        </div>
      </div>
    </div>
  )
}
