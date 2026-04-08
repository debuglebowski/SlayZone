import { Terminal } from '@slayzone/terminal/client/Terminal'
import type { TerminalMode } from '@slayzone/terminal/shared'

interface AgentSidePanelProps {
  width: number
  sessionId: string
  cwd: string
  mode: TerminalMode
  isActive: boolean
  isResizing?: boolean
}

export const AGENT_PANEL_MIN_WIDTH = 320
export const AGENT_PANEL_MAX_WIDTH = 720

export function AgentSidePanel({
  width,
  sessionId,
  cwd,
  mode,
  isActive,
  isResizing
}: AgentSidePanelProps) {
  return (
    <div className="relative h-full rounded-md bg-surface-1 border border-border overflow-hidden flex flex-col" style={{ width }}>
      <div className="flex items-center shrink-0 h-10 px-2 gap-1 border-b border-border bg-surface-1">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Agent</span>
      </div>
      <div className="flex-1 min-h-0">
        {isResizing ? (
          <div className="h-full bg-black" />
        ) : (
          <Terminal
            key={sessionId}
            sessionId={sessionId}
            cwd={cwd}
            mode={mode}
            isActive={isActive}
          />
        )}
      </div>
    </div>
  )
}
