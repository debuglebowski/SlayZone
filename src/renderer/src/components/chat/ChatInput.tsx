import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Square } from 'lucide-react'

interface Props {
  onSend: (message: string) => void
  onCancel: () => void
  isStreaming: boolean
  disabled?: boolean
}

export function ChatInput({ onSend, onCancel, isStreaming, disabled }: Props) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!isStreaming && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isStreaming])

  const handleSubmit = () => {
    if (value.trim() && !isStreaming) {
      onSend(value.trim())
      setValue('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="flex gap-2 p-4 border-t">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask Claude..."
        disabled={disabled || isStreaming}
        className="min-h-[60px] resize-none"
        rows={2}
      />
      {isStreaming ? (
        <Button onClick={onCancel} variant="destructive" size="icon">
          <Square className="h-4 w-4" />
        </Button>
      ) : (
        <Button onClick={handleSubmit} disabled={!value.trim() || disabled} size="icon">
          <Send className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
