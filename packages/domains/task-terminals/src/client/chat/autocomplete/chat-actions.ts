import type { ChatActions, SessionRef } from './types'

export interface ResetChatOptions {
  /** If true and a generation is in-flight, interrupt before killing. */
  interruptFirst?: boolean
  /** Called after successful restart. */
  onSuccess?: () => void
  /** Called on any error. */
  onError?: (err: unknown) => void
}

/**
 * Kill the current chat session and immediately spawn a fresh one w/ the same
 * tab/task/mode/cwd (and providerFlags override if set). Shared by the reset
 * button and the `/clear` builtin so both stay in sync.
 *
 * Single atomic IPC: kill + wipe persisted events + clear stored conversation id
 * + spawn fresh all happen on the main side in one handler. Earlier versions
 * orchestrated this client-side across multiple awaits, which let the dying
 * child's exit broadcast leak between IPCs and stick "Session ended".
 */
export async function resetChat(
  chat: ChatActions,
  session: SessionRef,
  opts: ResetChatOptions = {}
): Promise<void> {
  if (opts.interruptFirst) {
    try {
      await chat.interrupt(session.tabId)
    } catch {
      /* ignore — interrupt is best-effort */
    }
  }
  try {
    await chat.reset({
      tabId: session.tabId,
      taskId: session.taskId,
      mode: session.mode,
      cwd: session.cwd,
      providerFlagsOverride: session.providerFlagsOverride ?? null,
    })
    opts.onSuccess?.()
  } catch (err) {
    opts.onError?.(err)
    throw err
  }
}
