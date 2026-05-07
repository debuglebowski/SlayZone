import { useState, useEffect } from 'react'
import { getTrpcVanillaClient } from '@slayzone/transport/client'
import type { DetectedRepo } from '@slayzone/projects/shared'

export function useDetectedRepos(projectPath: string | null): DetectedRepo[] {
  const [repos, setRepos] = useState<DetectedRepo[]>([])
  useEffect(() => {
    if (!projectPath) { setRepos([]); return }
    getTrpcVanillaClient().worktrees.detectChildRepos.query({ projectPath: projectPath }).then(setRepos).catch(() => setRepos([]))
  }, [projectPath])
  return repos
}
