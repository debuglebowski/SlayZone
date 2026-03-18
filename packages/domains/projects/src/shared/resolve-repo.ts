import type { DetectedRepo } from './types'

export interface ResolvedRepo {
  path: string | null
  stale: boolean
}

/**
 * Resolve the effective repo path for a task or project home tab.
 *
 * - No detected repos → single-repo mode, return projectPath
 * - repoName matches a detected repo → return that repo's path
 * - repoName set but no match (repo renamed/deleted) → fallback to first, flag stale
 * - repoName null → return first detected repo
 */
export function resolveRepoPath(
  projectPath: string | null,
  detectedRepos: DetectedRepo[],
  repoName: string | null
): ResolvedRepo {
  if (detectedRepos.length === 0) {
    return { path: projectPath, stale: false }
  }

  if (repoName) {
    const match = detectedRepos.find((r) => r.name === repoName)
    if (match) return { path: match.path, stale: false }
    // Stale: saved repo no longer exists on disk
    return { path: detectedRepos[0].path, stale: true }
  }

  return { path: detectedRepos[0].path, stale: false }
}
