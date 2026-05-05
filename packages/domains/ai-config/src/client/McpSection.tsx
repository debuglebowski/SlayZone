import { McpServersPanel } from './McpServersPanel'
import { ComputerMcpView } from './ComputerMcpView'
import type { ConfigLevel } from '../shared'

interface McpSectionProps {
  level: ConfigLevel
  projectId: string | null
  projectPath?: string | null
}

export function McpSection({ level, projectId, projectPath }: McpSectionProps) {
  return (
    <div className="h-full overflow-y-auto">
      {level === 'computer' ? (
        <ComputerMcpView />
      ) : level === 'project' ? (
        <McpServersPanel
          mode="project"
          projectPath={projectPath ?? undefined}
          projectId={projectId ?? undefined}
        />
      ) : (
        // Library = favorites from curated catalog
        <McpServersPanel mode="computer" />
      )}
    </div>
  )
}
