import { useState, useEffect } from 'react'
import type { DetectedRepo } from '@slayzone/projects/shared'

export function useDetectedRepos(projectPath: string | null): DetectedRepo[] {
  const [repos, setRepos] = useState<DetectedRepo[]>([])
  useEffect(() => {
    if (!projectPath) { setRepos([]); return }
    window.api.git.detectChildRepos(projectPath).then(setRepos).catch(() => setRepos([]))
  }, [projectPath])
  return repos
}
