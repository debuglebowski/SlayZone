import { createContext, useContext } from 'react'

export interface ChatViewState {
  /**
   * Monotonic counter. When it increments, all expandable items should reset to collapsed.
   * Items subscribe via useEffect([collapseSignal]) → setOpen(false).
   */
  collapseSignal: number
  /** When true, timeline filters down to user messages + final assistant reply per turn. */
  finalOnly: boolean
}

export const ChatViewContext = createContext<ChatViewState>({
  collapseSignal: 0,
  finalOnly: false,
})

export function useChatView(): ChatViewState {
  return useContext(ChatViewContext)
}
