import { matchesShortcut } from './accelerator'
import { type ShortcutScope, SCOPE_PRIORITY } from './scope'

export interface HandlerEntry {
  id: string
  scope: ShortcutScope
  keys: string
  /** Return false to decline handling (event propagates normally). */
  handler: () => boolean | void
  enabled: boolean
}

export class ShortcutRegistry {
  private handlers: HandlerEntry[] = []

  /**
   * Register a shortcut handler. Returns an unsubscribe function.
   * Last-registered wins at same priority (innermost React component).
   */
  register(entry: Omit<HandlerEntry, 'enabled'> & { enabled?: boolean }): () => void {
    const full: HandlerEntry = { ...entry, enabled: entry.enabled ?? true }
    this.handlers.push(full)
    return () => {
      const idx = this.handlers.indexOf(full)
      if (idx !== -1) this.handlers.splice(idx, 1)
    }
  }

  /**
   * Find the highest-priority enabled handler matching the event and active scopes.
   * Calls the handler and prevents default if found.
   * Returns true if a handler fired.
   */
  dispatch(e: KeyboardEvent, activeScopes: Set<ShortcutScope>): boolean {
    // Find all matching handlers
    let best: HandlerEntry | null = null
    for (const entry of this.handlers) {
      if (!entry.enabled) continue
      if (!activeScopes.has(entry.scope)) continue
      if (!matchesShortcut(e, entry.keys)) continue
      // Pick highest priority. Among equal priority, last-registered wins (>=).
      if (!best || SCOPE_PRIORITY[entry.scope] >= SCOPE_PRIORITY[best.scope]) {
        best = entry
      }
    }

    if (!best) return false

    const result = best.handler()
    if (result === false) return false

    e.preventDefault()
    e.stopPropagation()
    return true
  }

  /** Clear all handlers (for testing). */
  clear(): void {
    this.handlers.length = 0
  }
}

export const registry = new ShortcutRegistry()
