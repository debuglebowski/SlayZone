import { ContextManagerShell } from './ContextManagerShell'

interface ContextManagerPageProps {
  selectedProjectId: string
  projectPath?: string | null
  projectName?: string
  onBack: () => void
  variant?: 'standalone' | 'panel'
}

export function ContextManagerPage({
  selectedProjectId,
  projectPath,
  projectName,
  onBack,
  variant = 'standalone',
}: ContextManagerPageProps) {
  return (
    <ContextManagerShell
      selectedProjectId={selectedProjectId}
      projectPath={projectPath}
      projectName={projectName}
      onBack={onBack}
      variant={variant}
    />
  )
}
