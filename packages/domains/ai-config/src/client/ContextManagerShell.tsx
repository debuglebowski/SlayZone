import { useState, useCallback } from 'react'
import { ArrowLeft, FileText, Server, Settings2, Sparkles } from 'lucide-react'
import { cn } from '@slayzone/ui'
import { LevelSwitcher } from './LevelSwitcher'
import { ProviderSyncSection } from './ProviderSyncSection'
import { InstructionsSection } from './InstructionsSection'
import { SkillsSection } from './SkillsSection'
import { McpSection } from './McpSection'
import type { ConfigLevel } from '../shared'

export interface ContextManagerShellProps {
  selectedProjectId: string | null
  projectPath?: string | null
  projectName?: string
  onBack: () => void
  variant?: 'standalone' | 'panel'
}

type Section = 'provider-sync' | 'instructions' | 'skills' | 'mcps'

const NAV_ITEMS: { id: Section; label: string; icon: typeof Sparkles }[] = [
  { id: 'provider-sync', label: 'Providers', icon: Settings2 },
  { id: 'instructions', label: 'Instructions', icon: FileText },
  { id: 'skills', label: 'Skills', icon: Sparkles },
  { id: 'mcps', label: 'MCPs', icon: Server },
]

export function ContextManagerShell({
  selectedProjectId,
  projectPath,
  projectName,
  onBack,
  variant = 'standalone',
}: ContextManagerShellProps) {
  const isPanel = variant === 'panel'
  const hasProject = !!selectedProjectId && !!projectPath

  const [section, setSection] = useState<Section>('instructions')
  const [level, setLevel] = useState<ConfigLevel>(hasProject ? 'project' : 'computer')

  const handleLevelChange = useCallback((newLevel: ConfigLevel) => {
    setLevel(newLevel)
  }, [])

  const handleSectionChange = useCallback((newSection: Section) => {
    setSection(newSection)
  }, [])

  const showLevelSwitcher = section !== 'provider-sync'

  const renderContent = () => {
    if (section === 'provider-sync') {
      return (
        <ProviderSyncSection
          projectId={selectedProjectId}
          projectName={projectName}
        />
      )
    }

    if (section === 'instructions') {
      return (
        <InstructionsSection
          level={level}
          projectId={selectedProjectId}
          projectPath={projectPath}
        />
      )
    }

    if (section === 'skills') {
      return (
        <SkillsSection
          level={level}
          projectId={selectedProjectId}
          projectPath={projectPath}
        />
      )
    }

    if (section === 'mcps') {
      return (
        <McpSection
          level={level}
          projectId={selectedProjectId}
          projectPath={projectPath}
        />
      )
    }

    return null
  }

  return (
    <div className={cn('flex h-full flex-col', isPanel ? '' : 'bg-surface-0')}>
      {/* Header */}
      {isPanel ? (
        <div className="shrink-0 h-10 px-2 border-b border-border bg-surface-1 flex items-center gap-1">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => handleSectionChange(id)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs font-medium transition-colors',
                section === id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
          {showLevelSwitcher && (
            <div className="ml-auto">
              <LevelSwitcher
                value={level}
                onChange={handleLevelChange}
                hasProject={hasProject}
                layout="pills"
              />
            </div>
          )}
        </div>
      ) : (
        <header className="flex shrink-0 items-center gap-4 border-b px-4 py-2.5">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
          </button>
          <h1 className="text-base font-semibold">Context Manager</h1>
          {showLevelSwitcher && (
            <div className="ml-auto">
              <LevelSwitcher
                value={level}
                onChange={handleLevelChange}
                hasProject={hasProject}
              />
            </div>
          )}
        </header>
      )}

      <div className="flex flex-1 min-h-0">
        {/* Left nav sidebar — standalone only */}
        {!isPanel && (
          <nav className="w-56 shrink-0 border-r border-border/50 p-3 space-y-1.5">
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => handleSectionChange(id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm transition-colors',
                  section === id
                    ? 'bg-surface-2 font-medium text-foreground ring-1 ring-border'
                    : 'text-muted-foreground hover:bg-surface-1 hover:text-foreground'
                )}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </nav>
        )}

        {/* Main content area */}
        <div className={cn('flex-1 min-h-0 min-w-0 overflow-y-auto', isPanel ? 'p-3' : 'p-6')}>
          {renderContent()}
        </div>
      </div>
    </div>
  )
}
