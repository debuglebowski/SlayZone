import { useState, useEffect, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useClaude } from '@/hooks/useClaude'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Loader2, Sparkles, Send, X, AlertCircle, RotateCcw, Undo2, Pencil } from 'lucide-react'
import type { WorkspaceItem } from '../../../../shared/types/database'
import { EditableTitle } from './EditableTitle'

interface Props {
  item: WorkspaceItem
  onUpdate: (item: WorkspaceItem) => void
}

interface Thought {
  id: string
  text: string
  createdAt: number
}

interface DumperData {
  thoughts: Thought[]
  deletedThoughts: Thought[]
  organized: string | null
  lastOrganizedAt: number | null
  lastOrganizedThoughtIds: string[]
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

const INCREMENTAL_SYSTEM_PROMPT = `You are updating a structured document based on changes.

Given:
1. The previous structured content
2. New thoughts to incorporate
3. Deleted thoughts to remove

Update the structure:
- Integrate new thoughts in the appropriate sections
- Remove content derived from deleted thoughts
- Keep the same format with ## Organized Thoughts and ## Gaps & Questions sections
- Be concise and actionable`

function generateId(): string {
  return crypto.randomUUID()
}

function parseDumperData(content: string | null): DumperData {
  const empty: DumperData = {
    thoughts: [],
    deletedThoughts: [],
    organized: null,
    lastOrganizedAt: null,
    lastOrganizedThoughtIds: []
  }
  if (!content) return empty

  try {
    const parsed = JSON.parse(content)
    // Migrate legacy string[] thoughts to Thought[]
    let thoughts: Thought[] = []
    if (Array.isArray(parsed.thoughts)) {
      thoughts = parsed.thoughts.map((t: string | Thought) => {
        if (typeof t === 'string') {
          return { id: generateId(), text: t, createdAt: Date.now() }
        }
        return t
      })
    }
    return {
      thoughts,
      deletedThoughts: Array.isArray(parsed.deletedThoughts) ? parsed.deletedThoughts : [],
      organized: parsed.organized || null,
      lastOrganizedAt: parsed.lastOrganizedAt ?? null,
      lastOrganizedThoughtIds: Array.isArray(parsed.lastOrganizedThoughtIds)
        ? parsed.lastOrganizedThoughtIds
        : []
    }
  } catch {
    // Legacy format: if content is not JSON, treat as organized content
    return { ...empty, organized: content }
  }
}

function serializeDumperData(data: DumperData): string {
  return JSON.stringify(data)
}

const AUTO_STRUCTURE_KEY = 'thoughts-auto-structure'

export function DumperPanel({ item, onUpdate }: Props) {
  const [input, setInput] = useState('')
  const [thoughts, setThoughts] = useState<Thought[]>([])
  const [deletedThoughts, setDeletedThoughts] = useState<Thought[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [output, setOutput] = useState<string | null>(null)
  const [lastOrganizedAt, setLastOrganizedAt] = useState<number | null>(null)
  const [autoStructure, setAutoStructure] = useState(() =>
    localStorage.getItem(AUTO_STRUCTURE_KEY) === 'true'
  )
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const { content, status, error, stream, cancel, reset } = useClaude()

  // Load saved data on item change
  useEffect(() => {
    const data = parseDumperData(item.content)
    setThoughts(data.thoughts)
    setDeletedThoughts(data.deletedThoughts)
    setOutput(data.organized)
    setLastOrganizedAt(data.lastOrganizedAt)
  }, [item.id, item.content])

  // Track pending organize metadata for the streaming complete effect
  const pendingOrganizeRef = useRef<{ thoughtIds: string[]; timestamp: number } | null>(null)

  // Update output when streaming completes
  useEffect(() => {
    if (status === 'done' && content) {
      setOutput(content)
      const now = Date.now()
      const pendingOrganize = pendingOrganizeRef.current
      const organizedThoughtIds = pendingOrganize?.thoughtIds ?? thoughts.map((t) => t.id)
      const organizedAt = pendingOrganize?.timestamp ?? now

      // Clear deleted thoughts and update metadata
      setDeletedThoughts([])
      setLastOrganizedAt(organizedAt)

      const updatedData: DumperData = {
        thoughts,
        deletedThoughts: [],
        organized: content,
        lastOrganizedAt: organizedAt,
        lastOrganizedThoughtIds: organizedThoughtIds
      }
      window.api.workspaceItems
        .update({
          id: item.id,
          content: serializeDumperData(updatedData)
        })
        .then(onUpdate)

      pendingOrganizeRef.current = null
    }
  }, [status, content, item.id, thoughts, onUpdate])

  const handleSend = async () => {
    if (!input.trim()) return
    const newThought: Thought = {
      id: generateId(),
      text: input.trim(),
      createdAt: Date.now()
    }
    const newThoughts = [...thoughts, newThought]
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

  const handleDeleteThought = async (thoughtId: string) => {
    const thoughtToDelete = thoughts.find((t) => t.id === thoughtId)
    if (!thoughtToDelete) return

    const newThoughts = thoughts.filter((t) => t.id !== thoughtId)
    const newDeletedThoughts = [...deletedThoughts, thoughtToDelete]
    setThoughts(newThoughts)
    setDeletedThoughts(newDeletedThoughts)

    // Save updated thoughts list
    const currentData = parseDumperData(item.content)
    const updatedData: DumperData = {
      ...currentData,
      thoughts: newThoughts,
      deletedThoughts: newDeletedThoughts
    }
    const updated = await window.api.workspaceItems.update({
      id: item.id,
      content: serializeDumperData(updatedData)
    })
    onUpdate(updated)
  }

  const handleRestoreThought = async (thoughtId: string) => {
    const thoughtToRestore = deletedThoughts.find((t) => t.id === thoughtId)
    if (!thoughtToRestore) return

    const newDeletedThoughts = deletedThoughts.filter((t) => t.id !== thoughtId)
    const newThoughts = [...thoughts, thoughtToRestore]
    setDeletedThoughts(newDeletedThoughts)
    setThoughts(newThoughts)

    const currentData = parseDumperData(item.content)
    const updatedData: DumperData = {
      ...currentData,
      thoughts: newThoughts,
      deletedThoughts: newDeletedThoughts
    }
    const updated = await window.api.workspaceItems.update({
      id: item.id,
      content: serializeDumperData(updatedData)
    })
    onUpdate(updated)
  }

  const handleStartEdit = (thought: Thought) => {
    setEditingId(thought.id)
    setEditText(thought.text)
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditText('')
  }

  const handleSaveEdit = async () => {
    if (!editingId || !editText.trim()) {
      handleCancelEdit()
      return
    }

    const newThoughts = thoughts.map((t) =>
      t.id === editingId ? { ...t, text: editText.trim() } : t
    )
    setThoughts(newThoughts)
    setEditingId(null)
    setEditText('')

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

  const buildOrganizePrompt = useCallback(() => {
    const hasExistingStructure = output && lastOrganizedAt
    const newThoughts = hasExistingStructure
      ? thoughts.filter((t) => t.createdAt > lastOrganizedAt)
      : thoughts

    if (!hasExistingStructure || (newThoughts.length === 0 && deletedThoughts.length === 0)) {
      // First organize or no changes - use all thoughts
      return {
        prompt: thoughts.map((t) => t.text).join('\n\n'),
        systemPrompt: SYSTEM_PROMPT
      }
    }

    // Incremental update
    let prompt = `## Previous Structure\n${output}\n\n`
    if (newThoughts.length > 0) {
      prompt += `## New Thoughts\n${newThoughts.map((t) => t.text).join('\n\n')}\n\n`
    }
    if (deletedThoughts.length > 0) {
      prompt += `## Deleted Thoughts (remove from structure)\n${deletedThoughts.map((t) => t.text).join('\n\n')}`
    }
    return { prompt, systemPrompt: INCREMENTAL_SYSTEM_PROMPT }
  }, [thoughts, deletedThoughts, output, lastOrganizedAt])

  const handleOrganize = async () => {
    if (thoughts.length === 0) return
    reset()
    pendingOrganizeRef.current = {
      thoughtIds: thoughts.map((t) => t.id),
      timestamp: Date.now()
    }
    const { prompt, systemPrompt } = buildOrganizePrompt()
    await stream(prompt, systemPrompt)
  }

  const handleStartOver = async () => {
    setOutput(null)
    setLastOrganizedAt(null)
    setDeletedThoughts([])
    reset()
    const updatedData: DumperData = {
      thoughts,
      deletedThoughts: [],
      organized: null,
      lastOrganizedAt: null,
      lastOrganizedThoughtIds: []
    }
    const updated = await window.api.workspaceItems.update({
      id: item.id,
      content: serializeDumperData(updatedData)
    })
    onUpdate(updated)
  }

  const handleAutoStructureToggle = (checked: boolean) => {
    setAutoStructure(checked)
    localStorage.setItem(AUTO_STRUCTURE_KEY, String(checked))
  }

  // Auto-structure effect
  const doOrganize = useCallback(() => {
    if (thoughts.length === 0) return
    reset()
    pendingOrganizeRef.current = {
      thoughtIds: thoughts.map((t) => t.id),
      timestamp: Date.now()
    }
    const { prompt, systemPrompt } = buildOrganizePrompt()
    stream(prompt, systemPrompt)
  }, [thoughts, reset, stream, buildOrganizePrompt])

  useEffect(() => {
    if (!autoStructure || thoughts.length === 0 || status === 'streaming') return

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(doOrganize, 1500)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [autoStructure, thoughts, doOrganize, status])

  const isStreaming = status === 'streaming'
  const displayContent = isStreaming ? content : output

  const handleRename = async (name: string) => {
    const updated = await window.api.workspaceItems.update({
      id: item.id,
      name
    })
    onUpdate(updated)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-2">
        <EditableTitle value={item.name} onChange={handleRename} />
      </div>
      {/* Side-by-side layout */}
      <div className="flex-1 flex min-h-0">
        {/* Left panel: Thoughts list with input at bottom */}
        <div className="flex-1 border-r flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Thoughts</h3>
            {thoughts.length === 0 && deletedThoughts.length === 0 ? (
              <p className="text-muted-foreground text-sm">No thoughts yet. Add some below.</p>
            ) : (
              <div className="space-y-2">
                {thoughts.map((thought) => (
                  <div
                    key={thought.id}
                    className="group relative p-3 rounded-md border bg-muted/50 hover:bg-muted transition-colors"
                  >
                    {editingId === thought.id ? (
                      <Textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="min-h-[60px] resize-none text-sm"
                        autoFocus
                        onBlur={handleSaveEdit}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                            e.preventDefault()
                            handleSaveEdit()
                          } else if (e.key === 'Escape') {
                            e.preventDefault()
                            handleCancelEdit()
                          }
                        }}
                      />
                    ) : (
                      <>
                        <p
                          className="text-sm whitespace-pre-wrap pr-14 cursor-text"
                          onClick={() => handleStartEdit(thought)}
                        >
                          {thought.text}
                        </p>
                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleStartEdit(thought)}
                            title="Edit"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleDeleteThought(thought.id)}
                            title="Delete"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {deletedThoughts.map((thought) => (
                  <div
                    key={thought.id}
                    className="group relative p-3 rounded-md border border-dashed opacity-50 transition-colors hover:opacity-75 cursor-pointer"
                    onClick={() => handleRestoreThought(thought.id)}
                    title="Click to restore"
                  >
                    <p className="text-sm whitespace-pre-wrap pr-8 line-through">{thought.text}</p>
                    <Undo2 className="absolute top-2 right-2 h-4 w-4 opacity-0 group-hover:opacity-100" />
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

        {/* Right panel: Structured thoughts */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Structured thoughts</h3>
            {status === 'error' ? (
              <div className="flex flex-col items-center justify-center h-full space-y-2 text-destructive">
                <AlertCircle className="h-8 w-8" />
                <p className="font-semibold">Error processing thoughts</p>
                {error && <p className="text-sm text-muted-foreground">{error}</p>}
              </div>
            ) : status === 'cancelled' ? (
              <div className="flex flex-col items-center justify-center h-full space-y-2 text-muted-foreground">
                <p className="font-semibold">Processing cancelled</p>
                <p className="text-sm">Click "Structure thoughts" to try again.</p>
              </div>
            ) : isStreaming && !displayContent ? (
              <div className="flex flex-col items-center justify-center h-full space-y-2 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
                <p className="text-sm">Structuring thoughts...</p>
              </div>
            ) : displayContent ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayContent}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                Structured thoughts will appear here.
              </p>
            )}
          </div>

          {/* Actions at bottom of right panel */}
          <div className="p-4 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  id="auto-structure"
                  checked={autoStructure}
                  onCheckedChange={handleAutoStructureToggle}
                />
                <Label htmlFor="auto-structure" className="text-sm cursor-pointer">
                  Auto-structure
                </Label>
              </div>
              <div className="flex gap-2">
                {isStreaming ? (
                  <Button variant="outline" size="sm" onClick={cancel}>
                    Cancel
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleStartOver}
                      disabled={!displayContent}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Start over
                    </Button>
                    <Button size="sm" onClick={handleOrganize} disabled={thoughts.length === 0}>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Structure thoughts
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
