/**
 * Merge `--effort <level>` into an existing provider flags string. Replaces any prior
 * `--effort …` and appends if absent. Preserves all other tokens verbatim.
 */
export function mergeEffortFlag(current: string | null, level: string): string {
  const tokens = (current ?? '').match(/\S+/g) ?? []
  const out: string[] = []
  let skipNext = false
  for (const tok of tokens) {
    if (skipNext) {
      skipNext = false
      continue
    }
    if (tok === '--effort') {
      skipNext = true
      continue
    }
    out.push(tok)
  }
  out.push('--effort', level)
  return out.join(' ')
}
