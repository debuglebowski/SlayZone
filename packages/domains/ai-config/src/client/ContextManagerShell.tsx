import { useState, useCallback } from 'react'
import { ArrowLeft, FileText, Server, Settings2, Sparkles } from 'lucide-react'
import { cn } from '@slayzone/ui'
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
}

type Section = 'provider-sync' | 'instructions' | 'skills' | 'mcps'

type ActiveItem =
  | { type: 'providers' }
  | { type: 'content'; level: ConfigLevel; section: Section }

const SECTION_ITEMS: { id: Section; label: string; icon: typeof Sparkles }[] = [
  { id: 'instructions', label: 'Instructions', icon: FileText },
  { id: 'skills', label: 'Skills', icon: Sparkles },
  { id: 'mcps', label: 'MCPs', icon: Server },
]

const LEVELS: { id: ConfigLevel; label: string }[] = [
  { id: 'computer', label: 'Computer' },
  { id: 'project', label: 'Project' },
  { id: 'library', label: 'Library' },
]

export function ContextManagerShell({
  selectedProjectId,
  projectPath,
  projectName,
  onBack,
}: ContextManagerShellProps) {
  const hasProject = !!selectedProjectId && !!projectPath

  const [active, setActive] = useState<ActiveItem>(
    () => ({ type: 'content', level: hasProject ? 'project' : 'computer', section: 'instructions' })
  )

  const handleSectionClick = useCallback((level: ConfigLevel, section: Section) => {
    setActive({ type: 'content', level, section })
  }, [])

  const handleNavigateToLibraryInstructions = useCallback(() => {
    setActive({ type: 'content', level: 'library', section: 'instructions' })
  }, [])

  const renderContent = () => {
    if (active.type === 'providers') {
      return (
        <ProviderSyncSection
          projectId={selectedProjectId}
          projectName={projectName}
        />
      )
    }

    const { level, section } = active

    if (section === 'instructions') {
      return (
        <InstructionsSection
          level={level}
          projectId={selectedProjectId}
          projectPath={projectPath}
          onNavigateToLibrary={handleNavigateToLibraryInstructions}
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
    <div className="flex h-full gap-3 bg-surface-0 p-3">
      {/* Sidebar */}
      <nav className="w-56 shrink-0 rounded-xl border border-border/50 bg-surface-1 flex flex-col overflow-y-auto">
        <header className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={onBack}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
          </button>
          <h1 className="text-sm font-semibold">Context Manager</h1>
        </header>

        <div className="h-px bg-border/50 mx-3" />

        <div className="flex-1 p-3 space-y-4">
          {/* Level groups */}
          {LEVELS.map(({ id: levelId, label: levelLabel }) => {
            const isDisabled = levelId === 'project' && !hasProject

            return (
              <div key={levelId} className={cn(isDisabled && 'pointer-events-none opacity-40')}>
                <div className="px-4 py-1 text-[11px] uppercase tracking-widest text-muted-foreground/60">
                  {levelLabel}
                </div>
                <div className="space-y-0.5">
                  {SECTION_ITEMS.map(({ id: sectionId, label: sectionLabel, icon: SectionIcon }) => {
                    const isActive = active.type === 'content' && active.level === levelId && active.section === sectionId
                    return (
                      <button
                        key={sectionId}
                        onClick={() => handleSectionClick(levelId, sectionId)}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-md px-4 py-1.5 text-xs transition-colors',
                          isActive
                            ? 'bg-surface-2 font-medium text-foreground ring-1 ring-border'
                            : 'text-muted-foreground hover:bg-surface-1 hover:text-foreground'
                        )}
                      >
                        <SectionIcon className="size-3.5" />
                        {sectionLabel}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Providers — pinned to bottom */}
        <div className="shrink-0 border-t border-border/50 mx-3" />
        <div className="shrink-0 p-3">
          <button
            onClick={() => setActive({ type: 'providers' })}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm transition-colors',
              active.type === 'providers'
                ? 'bg-surface-2 font-medium text-foreground ring-1 ring-border'
                : 'text-muted-foreground hover:bg-surface-1 hover:text-foreground'
            )}
          >
            <Settings2 className="size-4" />
            Providers
          </button>
        </div>
      </nav>

      {/* Main content */}
      <div className="flex-1 min-h-0 min-w-0 rounded-xl border border-border/50 bg-surface-1 flex flex-col overflow-hidden p-6">
        <h2 className="shrink-0 text-lg font-semibold mb-4">
          {active.type === 'providers'
            ? 'Providers'
            : `${LEVELS.find((l) => l.id === active.level)!.label} — ${SECTION_ITEMS.find((s) => s.id === active.section)!.label}`}
        </h2>
        <div className="flex-1 min-h-0">
          {renderContent()}
        </div>
      </div>
    </div>
  )
}
