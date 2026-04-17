import { readFile } from 'node:fs/promises'
import path from 'node:path'
import yaml from 'js-yaml'

export type Verdict = 'yes' | 'partial' | 'no' | 'unknown'
export type Confidence = 'high' | 'medium' | 'low'

export interface ComparisonAxis {
  verdict: Verdict
  confidence: Confidence
  note: string
  last_checked: string
}

export interface CompetitorAsset {
  path: string
  caption: string
  proves: string
  source_url: string
  captured_on: string
}

export interface CompetitorCanon {
  name: string
  slug: string
  last_checked: string
  primary_category: string
  platforms: string[]
  workflow_shape: string
  license: {
    type: string
    name: string
  }
  pricing: {
    model: string
    summary: string
  }
  relevance: {
    tier: string
    rationale: string
  }
  comparison_axes: Record<string, ComparisonAxis>
  assets?: CompetitorAsset[]
}

const frontmatterPattern = /^---\n([\s\S]*?)\n---\n/

function assertCanon(value: unknown, slug: string): asserts value is CompetitorCanon {
  if (!value || typeof value !== 'object') {
    throw new Error(`Invalid competitor canon for "${slug}".`)
  }
}

function normalizeDates<T>(value: T): T {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10) as T
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeDates(item)) as T
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalizeDates(item)]),
    ) as T
  }

  return value
}

export async function getCompetitorCanon(slug: string): Promise<CompetitorCanon> {
  const filePath = path.resolve(process.cwd(), '..', 'comparison', slug, 'index.md')
  const raw = await readFile(filePath, 'utf8')
  const match = raw.match(frontmatterPattern)

  if (!match) {
    throw new Error(`Missing frontmatter in competitor canon: ${slug}`)
  }

  const parsed = yaml.load(match[1])
  assertCanon(parsed, slug)
  return normalizeDates(parsed)
}
