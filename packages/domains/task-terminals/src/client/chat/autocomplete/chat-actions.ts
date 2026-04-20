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
 * Kill the current chat session and immediately create a fresh one w/ the same
 * tab/task/mode/cwd (and providerFlags override if set). Shared by the reset button
 * and the `/clear` builtin to keep both paths in sync.
 *
 * Must `remove` between kill and create: otherwise createChat sees the still-alive
 * old session in its map and returns it unchanged (early-return guard), so the reset
 * becomes a no-op.
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
    await chat.kill(session.tabId)
    await chat.remove(session.tabId)
    await chat.create({
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
