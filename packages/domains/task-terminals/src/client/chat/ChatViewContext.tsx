import { createContext, useContext } from 'react'

export interface ChatViewState {
  /**
   * Monotonic counter. When it increments, all expandable items should reset to collapsed.
   * Items subscribe via useEffect([collapseSignal]) → setOpen(false).
   */
  collapseSignal: number
  /** When true, timeline filters down to user messages + final assistant reply per turn. */
  finalOnly: boolean
  /**
   * Search highlight metadata. When `query` is non-empty, plain-text renderers
   * (UserMessage, ThinkingBlock, StderrBlock, ResultFooter expanded text, tool
   * inputs/outputs) wrap matches in `<mark>` so users see every hit, not just
   * the active item.
   */
  search: {
    query: string
    caseSensitive: boolean
  }
}

export const ChatViewContext = createContext<ChatViewState>({
  collapseSignal: 0,
  finalOnly: false,
  search: { query: '', caseSensitive: false },
})

export function useChatView(): ChatViewState {
  return useContext(ChatViewContext)
}
