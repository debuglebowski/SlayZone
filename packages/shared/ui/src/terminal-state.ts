/**
 * Terminal state styling - shared between TabBar and KanbanCard
 */

export type TerminalStateStyle = {
  color: string
  label: string
}

const TERMINAL_STATE_STYLES: Record<string, TerminalStateStyle> = {
  idle: { color: 'bg-blue-400', label: 'Idle' },
  dead: { color: 'bg-gray-400', label: 'Stopped' },
  starting: { color: 'bg-gray-400', label: 'Starting' },
  running: { color: 'bg-yellow-400', label: 'Working' },
  awaiting_input: { color: 'bg-yellow-400 animate-pulse', label: 'Awaiting input' },
  error: { color: 'bg-red-400', label: 'Error' }
}

export function getTerminalStateStyle(state: string | undefined): TerminalStateStyle | null {
  if (!state) return null
  return TERMINAL_STATE_STYLES[state] ?? null
}
