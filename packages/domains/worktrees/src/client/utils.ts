/**
 * Convert a string to a URL/branch-friendly slug
 * "Fix Login Bug" → "fix-login-bug"
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // remove special chars
    .replace(/[\s_]+/g, '-') // spaces/underscores to hyphens
    .replace(/-+/g, '-') // collapse multiple hyphens
    .replace(/^-|-$/g, '') // trim leading/trailing hyphens
}

export const DEFAULT_WORKTREE_BASE_PATH_TEMPLATE = '{project}/..'

/**
 * Expands user template tokens in worktree base path.
 * "{project}/.." with "/repo/slayzone" -> "/repo/slayzone/.."
 */
export function resolveWorktreeBasePathTemplate(template: string, projectPath: string): string {
  return template.replaceAll('{project}', projectPath.replace(/[\\/]+$/, ''))
}
