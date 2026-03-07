import { useState } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@slayzone/ui'
import {
  ContextManagerSettings,
  type ProjectContextManagerTab,
  type GlobalContextManagerSection
} from '../../../ai-config/src/client/ContextManagerSettings'
import type { Project } from '@slayzone/projects/shared'
import { SettingsTabIntro } from './project-settings-shared'

interface AiConfigTabProps {
  project: Project
  onOpenGlobalAiConfig?: (section: GlobalContextManagerSection) => void
}

export function AiConfigTab({ project, onOpenGlobalAiConfig }: AiConfigTabProps) {
  const [contextManagerTab, setContextManagerTab] = useState<ProjectContextManagerTab>('config')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <SettingsTabIntro
            title="Context Manager"
            description="Manage project-specific AI instructions, skills, and provider sync behavior. Use this to adapt global context to this project's workflow."
          />
        </div>
        <Tabs
          value={contextManagerTab}
          onValueChange={(value) => setContextManagerTab(value as ProjectContextManagerTab)}
          className="shrink-0"
        >
          <TabsList>
            <TabsTrigger value="config" data-testid="project-context-tab-config">Config</TabsTrigger>
            <TabsTrigger value="files" data-testid="project-context-tab-files">Files</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <ContextManagerSettings
        scope="project"
        projectId={project.id}
        projectPath={project.path}
        projectName={project.name}
        projectTab={contextManagerTab}
        onOpenGlobalAiConfig={onOpenGlobalAiConfig}
      />
    </div>
  )
}
