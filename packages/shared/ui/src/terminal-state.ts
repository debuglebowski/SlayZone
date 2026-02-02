/**
 * Terminal state styling - shared between TabBar and KanbanCard
 */

export type TerminalStateStyle = {
  color: string
  textColor: string
  label: string
}

const TERMINAL_STATE_STYLES: Record<string, TerminalStateStyle> = {
  dead: { color: 'bg-gray-400', textColor: 'text-gray-500', label: 'Stopped' },
  starting: { color: 'bg-gray-400', textColor: 'text-green-500', label: 'Starting' },
  running: { color: 'bg-blue-400 animate-pulse', textColor: 'text-blue-500', label: 'Active' },
  attention: { color: 'bg-orange-300', textColor: 'text-orange-500', label: 'Attention' },
  error: { color: 'bg-red-400', textColor: 'text-red-500', label: 'Error' }
}

export function getTerminalStateStyle(state: string | undefined): TerminalStateStyle | null {
  if (!state) return null
  return TERMINAL_STATE_STYLES[state] ?? null
}
