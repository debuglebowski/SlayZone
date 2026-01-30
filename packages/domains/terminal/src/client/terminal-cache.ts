import type { Terminal as XTerm } from '@xterm/xterm'
import type { FitAddon } from '@xterm/addon-fit'
import type { SerializeAddon } from '@xterm/addon-serialize'
import type { TerminalMode } from '@omgslayzone/terminal/shared'

export interface CachedTerminal {
  terminal: XTerm
  fitAddon: FitAddon
  serializeAddon: SerializeAddon
  element: HTMLElement
  serializedState?: string
  mode?: TerminalMode
}

// Module-level cache for terminal instances
const cache = new Map<string, CachedTerminal>()

// Track taskIds that shouldn't be re-cached (e.g., during restart/mode-change)
const skipCacheSet = new Set<string>()

export function getTerminal(taskId: string): CachedTerminal | undefined {
  return cache.get(taskId)
}

export function setTerminal(taskId: string, instance: CachedTerminal): void {
  // Don't cache if marked for skip (e.g., during restart/mode-change)
  if (skipCacheSet.has(taskId)) {
    skipCacheSet.delete(taskId)
    // Also clear any existing cache entry (from before restart was triggered)
    cache.delete(taskId)
    instance.terminal.dispose()
    return
  }
  cache.set(taskId, instance)
}

export function removeTerminal(taskId: string): boolean {
  const instance = cache.get(taskId)
  if (instance) {
    instance.terminal.dispose()
    cache.delete(taskId)
    return true
  }
  return false
}

// Dispose terminal without needing the instance (for idle hibernation)
export function disposeTerminal(taskId: string): boolean {
  // Clear skip flag if set (handles idle-before-restart race condition)
  skipCacheSet.delete(taskId)

  const instance = cache.get(taskId)
  if (instance) {
    instance.terminal.dispose()
    cache.delete(taskId)
    return true
  }
  return false
}

export function hasTerminal(taskId: string): boolean {
  return cache.has(taskId)
}

// Mark taskId to skip caching on next setTerminal call (for restart/mode-change)
export function markSkipCache(taskId: string): void {
  skipCacheSet.add(taskId)
  // Auto-clear after 2 seconds as safety net against stale entries
  setTimeout(() => {
    skipCacheSet.delete(taskId)
  }, 2000)
}

export function getCacheSize(): number {
  return cache.size
}
