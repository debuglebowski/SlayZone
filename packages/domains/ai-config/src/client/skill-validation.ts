import { deriveSkillValidation } from '../shared'
import type { AiConfigItem, MarketplaceProvenance, SkillValidationState } from '../shared'

export function getSkillValidation(
  item: Pick<AiConfigItem, 'type' | 'slug' | 'content'>
): SkillValidationState | null {
  if (item.type !== 'skill') return null
  return deriveSkillValidation(item.slug, item.content)
}

export function getMarketplaceProvenance(item: Pick<AiConfigItem, 'metadata_json'>): MarketplaceProvenance | null {
  try {
    const meta = JSON.parse(item.metadata_json)
    return meta?.marketplace ?? null
  } catch {
    return null
  }
}

export function getSkillFrontmatterActionLabel(validation: SkillValidationState | null | undefined): string | null {
  if (!validation || validation.status === 'valid') return null
  return validation.issues.some((issue) => issue.code === 'frontmatter_missing')
    ? 'Add frontmatter'
    : 'Fix frontmatter'
}
