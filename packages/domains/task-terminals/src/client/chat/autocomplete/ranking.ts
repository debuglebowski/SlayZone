/**
 * Generic prefix > substring > description scoring, alphabetical tiebreak.
 * Shared by skills / commands / agents / builtins sources.
 */
export interface RankAccessors<Item> {
  getName: (item: Item) => string
  getDescription?: (item: Item) => string
}

export function rankByName<Item>(
  items: Item[],
  query: string,
  accessors: RankAccessors<Item>
): Item[] {
  if (!query) {
    return [...items].sort((a, b) =>
      accessors.getName(a).localeCompare(accessors.getName(b))
    )
  }
  const q = query.toLowerCase()
  const { getName, getDescription } = accessors
  return items
    .map((item) => {
      const name = getName(item).toLowerCase()
      let score = 0
      if (name.startsWith(q)) score = 3
      else if (name.includes(q)) score = 2
      else if (getDescription && getDescription(item).toLowerCase().includes(q)) score = 1
      return { item, score, name: getName(item) }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .map((x) => x.item)
}
