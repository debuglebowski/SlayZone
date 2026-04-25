/**
 * Fuzzy ranking via fzf — name matches outrank description matches,
 * alphabetical tiebreak. Shared by skills / commands / agents / builtins.
 */
import { Fzf } from 'fzf'

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
