export type ShortcutScope = 'global' | 'task' | 'terminal' | 'editor' | 'browser'

export const SCOPE_PRIORITY: Record<ShortcutScope, number> = {
  editor: 80,
  terminal: 80,
  browser: 80,
  task: 40,
  global: 20,
}
