import { validateColumns, type ColumnConfig, type WorkflowCategory } from '@slayzone/workflow'
import { slugifyStatusName, type IntegrationProvider, type ProviderStatus, type StatusDiff } from '../shared'

const LINEAR_TYPE_TO_CATEGORY: Record<string, WorkflowCategory> = {
  triage: 'triage',
  backlog: 'backlog',
  unstarted: 'unstarted',
  started: 'started',
  completed: 'completed',
  canceled: 'canceled'
}

const GITHUB_NAME_HEURISTICS: Array<{ pattern: RegExp; category: WorkflowCategory }> = [
  { pattern: /^done$|^closed$|^complete[d]?$|^merged$/i, category: 'completed' },
  { pattern: /^cancel[led]*$|^won'?t\s*(do|fix)$/i, category: 'canceled' },
  { pattern: /^in\s*progress$|^in\s*review$|^review$|^active$/i, category: 'started' },
  { pattern: /^todo$|^to\s*do$|^ready$|^new$/i, category: 'unstarted' },
  { pattern: /^backlog$/i, category: 'backlog' },
  { pattern: /^triage$|^inbox$/i, category: 'triage' }
]

function guessGithubCategory(name: string): WorkflowCategory {
  for (const { pattern, category } of GITHUB_NAME_HEURISTICS) {
    if (pattern.test(name.trim())) return category
  }
  return 'unstarted'
}

const LINEAR_HEX_TO_TAILWIND: Array<{ hex: string; tw: string }> = [
  { hex: '#95a2b3', tw: 'gray' },
  { hex: '#bec2c8', tw: 'slate' },
  { hex: '#5e6ad2', tw: 'blue' },
  { hex: '#f2c94c', tw: 'yellow' },
  { hex: '#bb87fc', tw: 'purple' },
  { hex: '#4cb782', tw: 'green' },
  { hex: '#eb5757', tw: 'red' },
  { hex: '#f2994a', tw: 'orange' }
]

const GITHUB_COLOR_TO_TAILWIND: Record<string, string> = {
  GREEN: 'green',
  YELLOW: 'yellow',
  ORANGE: 'orange',
  RED: 'red',
  PINK: 'red',
  PURPLE: 'purple',
  BLUE: 'blue',
  GRAY: 'gray'
}

function hexDistance(a: string, b: string): number {
  const parse = (hex: string) => {
    const h = hex.replace('#', '')
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
  }
  const [r1, g1, b1] = parse(a)
  const [r2, g2, b2] = parse(b)
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2)
}

function mapLinearColor(hex: string): string {
  let best = 'gray'
  let bestDist = Infinity
  for (const { hex: candidate, tw } of LINEAR_HEX_TO_TAILWIND) {
    const dist = hexDistance(hex, candidate)
    if (dist < bestDist) {
      bestDist = dist
      best = tw
    }
  }
  return best
}

function mapGithubColor(color: string): string {
  return GITHUB_COLOR_TO_TAILWIND[color.toUpperCase()] ?? 'gray'
}

export interface StatusSyncResult {
  columns: ColumnConfig[]
  /** Maps provider status ID -> local column ID (handles dedup + sort) */
  providerIdToColumnId: Map<string, string>
}

export function providerStatusesToColumns(
  provider: IntegrationProvider,
  statuses: ProviderStatus[]
): StatusSyncResult {
  const columns: ColumnConfig[] = statuses.map((status, index) => {
    const category: WorkflowCategory = provider === 'linear' && status.type
      ? (LINEAR_TYPE_TO_CATEGORY[status.type] ?? 'unstarted')
      : guessGithubCategory(status.name)

    const color =
      provider === 'linear'
        ? mapLinearColor(status.color)
        : mapGithubColor(status.color)

    return {
      id: slugifyStatusName(status.name),
      label: status.name,
      color,
      position: status.position ?? index,
      category
    }
  })

  // Deduplicate IDs and track the final ID per provider status
  const seen = new Set<string>()
  const providerIdToColumnId = new Map<string, string>()

  for (let i = 0; i < columns.length; i++) {
    const col = columns[i]
    const providerStatusId = statuses[i].id
    if (seen.has(col.id)) {
      let suffix = 2
      while (seen.has(`${col.id}_${suffix}`)) suffix++
      col.id = `${col.id}_${suffix}`
    }
    seen.add(col.id)
    providerIdToColumnId.set(providerStatusId, col.id)
  }

  // validateColumns sorts by category — column IDs are stable through sort
  const validated = validateColumns(columns)

  return { columns: validated, providerIdToColumnId }
}

/**
 * Compute diff between current and incoming columns using provider status IDs.
 * `currentIdMap`: local column id -> provider status id (from integration_state_mappings)
 * `incomingStatuses`: fresh provider statuses with their IDs
 */
export function computeStatusDiff(
  current: ColumnConfig[],
  incomingStatuses: ProviderStatus[],
  currentIdMap: Map<string, string>
): StatusDiff {
  // Build reverse map: provider status id -> current column
  const currentByProviderId = new Map<string, ColumnConfig>()
  for (const col of current) {
    const providerId = currentIdMap.get(col.id)
    if (providerId) currentByProviderId.set(providerId, col)
  }

  const added: ProviderStatus[] = []
  const removed: ColumnConfig[] = []
  const renamed: Array<{ old: ColumnConfig; new: ProviderStatus }> = []
  const matchedProviderIds = new Set<string>()

  for (const status of incomingStatuses) {
    const currentCol = currentByProviderId.get(status.id)
    if (!currentCol) {
      added.push(status)
    } else {
      matchedProviderIds.add(status.id)
      if (currentCol.label !== status.name) {
        renamed.push({ old: currentCol, new: status })
      }
    }
  }

  for (const col of current) {
    const providerId = currentIdMap.get(col.id)
    if (providerId && !matchedProviderIds.has(providerId)) {
      removed.push(col)
    }
  }

  return { added, removed, renamed }
}
