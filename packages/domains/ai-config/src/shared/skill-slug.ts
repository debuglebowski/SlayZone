/**
 * Derives a skill slug from a context-relative file path.
 *
 * Examples:
 *   '.claude/skills/my-skill/SKILL.md' → 'my-skill'
 *   '.agents/skills/flat.md' → 'flat'
 *   'SKILL.md' → null
 */
export function skillSlugFromContextPath(relativePath: string): string | null {
  const normalized = relativePath.split('\\').join('/')
  const parts = normalized.split('/').filter(Boolean)
  if (parts.length === 0) return null

  const fileName = parts[parts.length - 1]
  if (fileName === 'SKILL.md') {
    if (parts.length < 2) return null
    return parts[parts.length - 2]
  }

  if (fileName.toLowerCase().endsWith('.md')) {
    return fileName.slice(0, -3)
  }

  return null
}
