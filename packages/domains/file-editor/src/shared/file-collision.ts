export function splitNameExt(name: string): { stem: string; ext: string } {
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return { stem: name, ext: '' }
  return { stem: name.slice(0, dot), ext: name.slice(dot) }
}

export function uniqueName(desired: string, taken: ReadonlySet<string>): string {
  if (!taken.has(desired)) return desired
  const { stem, ext } = splitNameExt(desired)
  for (let i = 1; ; i++) {
    const candidate = `${stem} (${i})${ext}`
    if (!taken.has(candidate)) return candidate
  }
}

export function duplicateName(originalName: string, taken: ReadonlySet<string>): string {
  const { stem, ext } = splitNameExt(originalName)
  let candidate = `${stem} (copy)${ext}`
  if (!taken.has(candidate)) return candidate
  for (let i = 2; ; i++) {
    candidate = `${stem} (copy ${i})${ext}`
    if (!taken.has(candidate)) return candidate
  }
}
