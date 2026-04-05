import { ContextManagerShell } from './ContextManagerShell'
import { useContextManagerStore } from './useContextManagerStore'

interface ContextManagerPageProps {
  selectedProjectId: string
  projectPath?: string | null
  projectName?: string
  onBack: () => void
}

export function ContextManagerPage({
  selectedProjectId,
  projectPath,
  projectName,
  onBack,
}: ContextManagerPageProps) {
  const isLoaded = useContextManagerStore((s) => s.isLoaded)

  if (!isLoaded) return null

  return (
    <ContextManagerShell
      selectedProjectId={selectedProjectId}
      projectPath={projectPath}
      projectName={projectName}
      onBack={onBack}
    />
  )
}
