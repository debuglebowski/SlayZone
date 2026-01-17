import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useClaude } from '@/hooks/useClaude'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Save, Sparkles } from 'lucide-react'
import type { WorkspaceItem } from '../../../../shared/types/database'

interface Props {
  item: WorkspaceItem
  onUpdate: (item: WorkspaceItem) => void
}

const SYSTEM_PROMPT = `You are a thought organizer. Given raw unstructured thoughts:
1. Organize them into clear, logical sections with headers
2. Identify gaps, missing information, or questions that need answers
3. Be concise and actionable

Format your response as:
## Organized Thoughts
[Structured version of the input]

## Gaps & Questions
- [Question or gap 1]
- [Question or gap 2]
...`

export function DumperPanel({ item, onUpdate }: Props) {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState(item.content ?? '')
  const { content, status, stream, cancel, reset } = useClaude()

  // Load saved content on item change
  useEffect(() => {
    setOutput(item.content ?? '')
  }, [item.id, item.content])

  // Update output when streaming completes
  useEffect(() => {
    if (status === 'done' && content) {
      setOutput(content)
    }
  }, [status, content])

  const handleProcess = async () => {
    if (!input.trim()) return
    reset()
    await stream(input, SYSTEM_PROMPT)
  }

  const handleSave = async () => {
    const contentToSave = status === 'streaming' ? content : output
    if (contentToSave && contentToSave !== item.content) {
      const updated = await window.api.workspaceItems.update({
        id: item.id,
        content: contentToSave
      })
      onUpdate(updated)
    }
  }

  const isStreaming = status === 'streaming'
  const displayContent = isStreaming ? content : output

  return (
    <div className="flex flex-col h-full">
      {/* Input area */}
      <div className="p-4 border-b space-y-3">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Dump your unorganized thoughts here..."
          className="min-h-[120px] resize-none"
          disabled={isStreaming}
        />
        <div className="flex gap-2">
          <Button onClick={handleProcess} disabled={isStreaming || !input.trim()}>
            {isStreaming ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Organize
              </>
            )}
          </Button>
          {isStreaming && (
            <Button variant="outline" onClick={cancel}>
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Output area */}
      <div className="flex-1 overflow-y-auto p-4">
        {displayContent ? (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayContent}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            Organized thoughts will appear here after processing.
          </p>
        )}
      </div>

      {/* Save button */}
      {displayContent && displayContent !== item.content && (
        <div className="p-4 border-t">
          <Button onClick={handleSave} variant="outline" className="w-full">
            <Save className="h-4 w-4 mr-2" />
            Save to workspace
          </Button>
        </div>
      )}
    </div>
  )
}
