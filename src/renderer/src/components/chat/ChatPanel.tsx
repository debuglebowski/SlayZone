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

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {/* Show streaming content */}
        {isStreaming && content && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg px-4 py-2 bg-muted">
              <p className="text-sm whitespace-pre-wrap">{content}</p>
            </div>
          </div>
        )}
      </div>
      <ChatInput onSend={handleSend} onCancel={cancel} isStreaming={isStreaming} />
    </div>
  )
}
