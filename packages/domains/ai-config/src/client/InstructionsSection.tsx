import { ProjectInstructions } from './ProjectInstructions'
import { GlobalContextFiles } from './GlobalContextFiles'
import { InstructionVariantsView } from './InstructionVariantsView'
import type { ConfigLevel } from '../shared'

interface InstructionsSectionProps {
  level: ConfigLevel
  projectId: string | null
  projectPath?: string | null
}

export function InstructionsSection({ level, projectId, projectPath }: InstructionsSectionProps) {
  if (level === 'computer') {
    return <GlobalContextFiles filter="instructions" />
  }

  if (level === 'project') {
    return (
      <ProjectInstructions
        projectId={projectId}
        projectPath={projectPath}
      />
    )
  }

  // Library level
  return (
    <InstructionVariantsView
      projectId={projectId}
    />
  )
}
