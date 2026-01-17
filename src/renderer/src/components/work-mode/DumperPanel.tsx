import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useClaude } from '@/hooks/useClaude'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Save, Sparkles, Send, X, AlertCircle } from 'lucide-react'
import type { WorkspaceItem } from '../../../../shared/types/database'

interface Props {
  item: WorkspaceItem
  onUpdate: (item: WorkspaceItem) => void
}

interface DumperData {
  thoughts: string[]
  organized: string | null
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

function parseDumperData(content: string | null): DumperData {
  if (!content) {
    return { thoughts: [], organized: null }
  }
  try {
    const parsed = JSON.parse(content)
    return {
      thoughts: Array.isArray(parsed.thoughts) ? parsed.thoughts : [],
      organized: parsed.organized || null
    }
  } catch {
    // Legacy format: if content is not JSON, treat as organized content
    return { thoughts: [], organized: content }
  }
}

function serializeDumperData(data: DumperData): string {
  return JSON.stringify(data)
}

export function DumperPanel({ item, onUpdate }: Props) {
  const [input, setInput] = useState('')
  const [thoughts, setThoughts] = useState<string[]>([])
  const [output, setOutput] = useState<string | null>(null)
  const { content, status, error, stream, cancel, reset } = useClaude()

  // Load saved data on item change
  useEffect(() => {
    const data = parseDumperData(item.content)
    setThoughts(data.thoughts)
    setOutput(data.organized)
  }, [item.id, item.content])

  // Update output when streaming completes
  useEffect(() => {
    if (status === 'done' && content) {
      setOutput(content)
      // Save organized content to workspace
      const currentData = parseDumperData(item.content)
      const updatedData: DumperData = {
        ...currentData,
        organized: content
      }
      window.api.workspaceItems.update({
        id: item.id,
        content: serializeDumperData(updatedData)
      }).then(onUpdate)
    }
  }, [status, content, item.id, item.content, onUpdate])

  const handleSend = async () => {
    if (!input.trim()) return
    const newThoughts = [...thoughts, input.trim()]
    setThoughts(newThoughts)
    setInput('')

    // Save updated thoughts list
    const currentData = parseDumperData(item.content)
    const updatedData: DumperData = {
      ...currentData,
      thoughts: newThoughts
    }
    const updated = await window.api.workspaceItems.update({
      id: item.id,
      content: serializeDumperData(updatedData)
    })
    onUpdate(updated)
  }

  const handleDeleteThought = async (index: number) => {
    const newThoughts = thoughts.filter((_, i) => i !== index)
    setThoughts(newThoughts)

    // Save updated thoughts list
    const currentData = parseDumperData(item.content)
    const updatedData: DumperData = {
      ...currentData,
      thoughts: newThoughts
    }
    const updated = await window.api.workspaceItems.update({
      id: item.id,
      content: serializeDumperData(updatedData)
    })
    onUpdate(updated)
  }

  const handleOrganize = async () => {
    if (thoughts.length === 0) return
    reset()
    const combinedThoughts = thoughts.join('\n\n')
    await stream(combinedThoughts, SYSTEM_PROMPT)
  }

  const handleSave = async () => {
    const contentToSave = status === 'streaming' ? content : output
    if (contentToSave) {
      const currentData = parseDumperData(item.content)
      const updatedData: DumperData = {
        ...currentData,
        organized: contentToSave
      }
      const updated = await window.api.workspaceItems.update({
        id: item.id,
        content: serializeDumperData(updatedData)
      })
      onUpdate(updated)
    }
  }

  const isStreaming = status === 'streaming'
  const displayContent = isStreaming ? content : output
  const hasChanges = displayContent && displayContent !== parseDumperData(item.content).organized

  return (
    <div className="flex flex-col h-full">
      {/* Side-by-side layout */}
      <div className="flex-1 flex min-h-0">
        {/* Left panel: Thoughts list with input at bottom */}
        <div className="flex-1 border-r flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-4">
            <h3 className="text-sm font-semibold mb-3">Dumped Thoughts</h3>
            {thoughts.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No thoughts yet. Add some thoughts below and click "Send".
              </p>
            ) : (
              <div className="space-y-2">
                {thoughts.map((thought, index) => (
                  <div
                    key={index}
                    className="group relative p-3 rounded-md border bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <p className="text-sm whitespace-pre-wrap pr-8">{thought}</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100"
                      onClick={() => handleDeleteThought(index)}
                      title="Delete"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Input area at bottom of left panel */}
          <div className="p-4">
            <div className="relative">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Dump your unorganized thoughts here..."
                className="min-h-[120px] resize-none pr-12 pb-12"
                disabled={isStreaming}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
              />
              <Button
                onClick={handleSend}
                disabled={isStreaming || !input.trim()}
                size="icon"
                className="absolute bottom-2 right-2 z-10 h-8 w-8"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Right panel: Organized output */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-4">
            {status === 'error' ? (
              <div className="flex flex-col items-center justify-center h-full space-y-2 text-destructive">
                <AlertCircle className="h-8 w-8" />
                <p className="font-semibold">Error processing thoughts</p>
                {error && <p className="text-sm text-muted-foreground">{error}</p>}
              </div>
            ) : status === 'cancelled' ? (
              <div className="flex flex-col items-center justify-center h-full space-y-2 text-muted-foreground">
                <p className="font-semibold">Processing cancelled</p>
                <p className="text-sm">Click "Organize" to try again.</p>
              </div>
            ) : isStreaming && !displayContent ? (
              <div className="flex flex-col items-center justify-center h-full space-y-2 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
                <p className="text-sm">Organizing thoughts...</p>
              </div>
            ) : displayContent ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayContent}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                Organized thoughts will appear here after processing.
              </p>
            )}
          </div>

          {/* Buttons at bottom of right panel */}
          <div className="p-4">
            <div className="flex gap-2 justify-center">
              {isStreaming ? (
                <Button variant="outline" onClick={cancel}>
                  Cancel
                </Button>
              ) : (
                <>
                  <Button onClick={handleOrganize} disabled={thoughts.length === 0}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Organize
                  </Button>
                  {hasChanges && (
                    <Button onClick={handleSave} variant="outline">
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
