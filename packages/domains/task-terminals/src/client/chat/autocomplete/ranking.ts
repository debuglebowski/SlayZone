/**
 * Fuzzy ranking via fzf — name matches outrank description matches,
 * alphabetical tiebreak. Shared by skills / commands / agents / builtins.
 */
import { Fzf } from 'fzf'
import type { AutocompleteSource } from './types'

export interface RankAccessors<Item> {
  getName: (item: Item) => string
  getDescription?: (item: Item) => string
}

// fzf's `U extends string` conditional options typing breaks under generics — safe cast.
function makeFzf<T>(items: T[], selector: (t: T) => string): Fzf<readonly T[]> {
  type AnyCtor = new (list: readonly T[], opts: unknown) => Fzf<readonly T[]>
  return new (Fzf as unknown as AnyCtor)(items, { selector, casing: 'case-insensitive' })
}

export function rankByName<Item>(
  items: Item[],
  query: string,
  accessors: RankAccessors<Item>
): Item[] {
  const { getName, getDescription } = accessors

  if (!query) {
    return [...items].sort((a, b) => getName(a).localeCompare(getName(b)))
  }

  const nameHits = makeFzf(items, getName).find(query)
  const matched = new Set<Item>(nameHits.map((h) => h.item))

  const merged: { item: Item; score: number }[] = nameHits.map((h) => ({
    item: h.item,
    score: h.score,
  }))

  if (getDescription) {
    const pool = items.filter((i) => !matched.has(i))
    for (const h of makeFzf(pool, getDescription).find(query)) {
      merged.push({ item: h.item, score: 0 })
    }
  }

  merged.sort(
    (a, b) => b.score - a.score || getName(a.item).localeCompare(getName(b.item))
  )
  return merged.map((m) => m.item)
}

export interface MergedEntry {
  item: unknown
  source: AutocompleteSource
}

interface SourceGroup {
  source: AutocompleteSource
  items: unknown[]
}

/**
 * Cross-source fzf ranking. Builds a single ranked list across multiple sources by running
 * fzf on the union (using each source's `getName` / `getDescription` accessors). Name hits
 * outrank description hits; ties broken alphabetically. Sources that lack `getName` are
 * appended in their own filter order at the end.
 */
export function rankAcrossSources(groups: SourceGroup[], query: string): MergedEntry[] {
  const mergeable = groups.filter((g) => g.source.getName)
  const passthrough = groups.filter((g) => !g.source.getName)

  type U = MergedEntry & { name: string; description: string }
  const universe: U[] = []
  for (const g of mergeable) {
    const getName = g.source.getName as (i: unknown) => string
    const getDesc = g.source.getDescription as ((i: unknown) => string) | undefined
    for (const item of g.items) {
      universe.push({
        item,
        source: g.source,
        name: getName(item),
        description: getDesc ? getDesc(item) : '',
      })
    }
  }

  let ranked: MergedEntry[]
  if (!query) {
    ranked = [...universe].sort((a, b) => a.name.localeCompare(b.name))
  } else {
    const nameHits = makeFzf(universe, (u) => u.name).find(query)
    const matched = new Set<U>(nameHits.map((h) => h.item))
    const merged: { entry: U; score: number }[] = nameHits.map((h) => ({
      entry: h.item,
      score: h.score,
    }))
    const pool = universe.filter((u) => !matched.has(u) && u.description)
    for (const h of makeFzf(pool, (u) => u.description).find(query)) {
      merged.push({ entry: h.item, score: 0 })
    }
    merged.sort(
      (a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name)
    )
    ranked = merged.map((m) => ({ item: m.entry.item, source: m.entry.source }))
  }

  for (const g of passthrough) {
    for (const item of g.items) ranked.push({ item, source: g.source })
  }
  return ranked
}
