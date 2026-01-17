import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  onSave: () => Promise<void>
  placeholder?: string
}

export function MarkdownEditor({
  value,
  onChange,
  onSave,
  placeholder = 'Click to add description...'
}: MarkdownEditorProps): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Focus textarea and move cursor to end when entering edit mode
  useEffect(() => {
    if (editing && textareaRef.current) {
      const textarea = textareaRef.current
      textarea.focus()
      textarea.setSelectionRange(textarea.value.length, textarea.value.length)
    }
  }, [editing])

  const handleBlur = async (): Promise<void> => {
    await onSave()
    setEditing(false)
  }

  const handleKeyDown = async (e: React.KeyboardEvent): Promise<void> => {
    if (e.key === 'Escape') {
      setEditing(false)
      return
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      await onSave()
      setEditing(false)
    }
  }

  if (editing) {
    return (
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="min-h-[200px] font-mono"
        placeholder={placeholder}
      />
    )
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className={cn(
        'min-h-[100px] cursor-pointer rounded-md border border-transparent p-3 hover:border-border',
        !value && 'text-muted-foreground'
      )}
    >
      {value ? (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          className="prose prose-sm dark:prose-invert max-w-none"
        >
          {value}
        </ReactMarkdown>
      ) : (
        placeholder
      )}
    </div>
  )
}
