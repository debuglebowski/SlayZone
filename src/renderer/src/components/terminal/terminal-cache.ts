import type { Terminal as XTerm } from '@xterm/xterm'
import type { FitAddon } from '@xterm/addon-fit'

export interface CachedTerminal {
  terminal: XTerm
  fitAddon: FitAddon
  element: HTMLElement
}

// Module-level cache for terminal instances
const cache = new Map<string, CachedTerminal>()

export function getTerminal(taskId: string): CachedTerminal | undefined {
  return cache.get(taskId)
}

export function setTerminal(taskId: string, instance: CachedTerminal): void {
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

export function getCacheSize(): number {
  return cache.size
}
