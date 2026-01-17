import { useReducer, useCallback, useEffect } from 'react'
import type { ClaudeStreamEvent, ChatMessage } from '../../../shared/types/api'

type StreamStatus = 'idle' | 'streaming' | 'done' | 'error' | 'cancelled'

interface StreamState {
  status: StreamStatus
  content: string
  error: string | null
  messages: ChatMessage[]
}

type StreamAction =
  | { type: 'START' }
  | { type: 'CHUNK'; text: string }
  | { type: 'DONE' }
  | { type: 'ERROR'; error: string }
  | { type: 'CANCEL' }
  | { type: 'RESET' }
  | { type: 'ADD_MESSAGE'; message: ChatMessage }
  | { type: 'SET_MESSAGES'; messages: ChatMessage[] }

function streamReducer(state: StreamState, action: StreamAction): StreamState {
  switch (action.type) {
    case 'START':
      return { ...state, status: 'streaming', content: '', error: null }
    case 'CHUNK':
      return { ...state, content: state.content + action.text }
    case 'DONE':
      // Don't overwrite error state
      if (state.status === 'error') return state
      return { ...state, status: 'done' }
    case 'ERROR':
      return { ...state, status: 'error', error: action.error }
    case 'CANCEL':
      return { ...state, status: 'cancelled' }
    case 'RESET':
      return { ...state, status: 'idle', content: '', error: null }
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.message] }
    case 'SET_MESSAGES':
      return { ...state, messages: action.messages }
    default:
      return state
  }
}

export function useClaude(workspaceItemId?: string) {
  const [state, dispatch] = useReducer(streamReducer, {
    status: 'idle',
    content: '',
    error: null,
    messages: []
  })

  // Load existing messages
  useEffect(() => {
    if (!workspaceItemId) return
    window.api.chatMessages.getByWorkspace(workspaceItemId).then((msgs) => {
      dispatch({ type: 'SET_MESSAGES', messages: msgs })
    })
  }, [workspaceItemId])

  // Subscribe to stream events
  useEffect(() => {
    const unsubChunk = window.api.claude.onChunk((data: ClaudeStreamEvent) => {
      console.log('[useClaude] Chunk:', data.type, data.subtype || data.event?.type || '')

      // Handle assistant message (final or without --include-partial-messages)
      if (data.type === 'assistant' && data.message?.content) {
        for (const block of data.message.content) {
          if (block.type === 'text' && block.text) {
            dispatch({ type: 'CHUNK', text: block.text })
          }
        }
      }

      // Handle stream_event (incremental streaming with --include-partial-messages)
      if (data.type === 'stream_event' && data.event?.type === 'content_block_delta') {
        const text = data.event.delta?.text
        if (text) {
          dispatch({ type: 'CHUNK', text })
        }
      }
    })

    const unsubError = window.api.claude.onError((error) => {
      dispatch({ type: 'ERROR', error })
    })

    const unsubDone = window.api.claude.onDone((result) => {
      // If exit code is non-zero, treat as error
      if (result.code !== 0) {
        dispatch({ type: 'ERROR', error: `Claude CLI exited with code ${result.code}` })
      } else {
        dispatch({ type: 'DONE' })
      }
    })

    return () => {
      unsubChunk()
      unsubError()
      unsubDone()
    }
  }, [])

  const stream = useCallback(async (prompt: string, context?: string) => {
    dispatch({ type: 'START' })
    await window.api.claude.stream(prompt, context)
  }, [])

  const cancel = useCallback(() => {
    window.api.claude.cancel()
    dispatch({ type: 'CANCEL' })
  }, [])

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' })
  }, [])

  const addMessage = useCallback((message: ChatMessage) => {
    dispatch({ type: 'ADD_MESSAGE', message })
  }, [])

  return {
    ...state,
    stream,
    cancel,
    reset,
    addMessage
  }
}
