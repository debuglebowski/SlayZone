import { useRef, useEffect } from 'react'
import { useClaude } from '@/hooks/useClaude'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import type { Task } from '../../../../shared/types/database'
import type { ChatMessage as ChatMessageType } from '../../../../shared/types/api'

interface Props {
  task: Task
  workspaceItemId?: string
}

export function ChatPanel({ task, workspaceItemId }: Props) {
  const { messages, content, status, stream, cancel, addMessage } = useClaude(workspaceItemId)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll on new content
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, content])

  // Build task context
  const buildContext = () => {
    const lines = [
      `Current task: ${task.title}`,
      `Status: ${task.status}`,
      `Priority: P${task.priority}`
    ]
    if (task.description) lines.push(`Description: ${task.description}`)
    if (task.due_date) lines.push(`Due: ${task.due_date}`)
    return lines.join('\n')
  }

  const handleSend = async (prompt: string) => {
    // Add user message to display immediately
    const userMsg: ChatMessageType = {
      id: crypto.randomUUID(),
      workspace_item_id: workspaceItemId || '',
      role: 'user',
      content: prompt,
      created_at: new Date().toISOString()
    }
    addMessage(userMsg)

    // Persist user message if workspace exists
    if (workspaceItemId) {
      await window.api.chatMessages.create({
        workspaceItemId,
        role: 'user',
        content: prompt
      })
    }

    // Start streaming
    await stream(prompt, buildContext())
  }

  // Save assistant response when done
  useEffect(() => {
    if (status === 'done' && content && workspaceItemId) {
      const assistantMsg: ChatMessageType = {
        id: crypto.randomUUID(),
        workspace_item_id: workspaceItemId,
        role: 'assistant',
        content,
        created_at: new Date().toISOString()
      }
      addMessage(assistantMsg)
      window.api.chatMessages.create({
        workspaceItemId,
        role: 'assistant',
        content
      })
    }
  }, [status, content, workspaceItemId, addMessage])

  const isStreaming = status === 'streaming'
  const showLoading = isStreaming && !content

  // Create a temporary message for streaming content
  const streamingMessage: ChatMessageType | null =
    isStreaming && content
      ? {
          id: 'streaming',
          workspace_item_id: workspaceItemId || '',
          role: 'assistant',
          content,
          created_at: new Date().toISOString()
        }
      : null

  return (
    <div className="flex flex-col h-full bg-background">
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto py-6 scroll-smooth"
      >
        <div className="max-w-2xl mx-auto px-4 space-y-6">
          {messages.length === 0 && !isStreaming && (
            <div className="flex items-center justify-center h-full min-h-[400px]">
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold text-foreground">
                  Start a conversation
                </h3>
                <p className="text-muted-foreground text-sm leading-6">
                  Ask Claude questions about your task, get help with implementation, or brainstorm ideas.
                </p>
              </div>
            </div>
          )}
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          {showLoading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1.5 py-2">
                <span className="flex gap-1.5">
                  <span className="h-2 w-2 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:0ms] [animation-duration:1.4s]" />
                  <span className="h-2 w-2 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:0.2s] [animation-duration:1.4s]" />
                  <span className="h-2 w-2 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:0.4s] [animation-duration:1.4s]" />
                </span>
              </div>
            </div>
          )}
          {streamingMessage && <ChatMessage message={streamingMessage} />}
        </div>
      </div>
      <ChatInput onSend={handleSend} onCancel={cancel} isStreaming={isStreaming} />
    </div>
  )
}
