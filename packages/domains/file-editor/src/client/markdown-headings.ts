export interface MarkdownHeading {
  level: 1 | 2 | 3 | 4 | 5 | 6
  text: string
  /** 1-based line number */
  line: number
  /** 0-based index in document order */
  index: number
}

/**
 * Extract markdown headings (ATX `#` and Setext `===` / `---`) from source.
 * Skips fenced code blocks (``` and ~~~).
 */
export function parseMarkdownHeadings(source: string): MarkdownHeading[] {
  const lines = source.split('\n')
  const headings: MarkdownHeading[] = []
  let inFence = false
  let fenceMarker = ''
  let index = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const fenceMatch = line.match(/^(\s*)(`{3,}|~{3,})/)
    if (fenceMatch) {
      const marker = fenceMatch[2][0]
      if (!inFence) {
        inFence = true
        fenceMarker = marker
      } else if (marker === fenceMarker) {
        inFence = false
        fenceMarker = ''
      }
      continue
    }
    if (inFence) continue

    const atx = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/)
    if (atx) {
      const level = atx[1].length as 1 | 2 | 3 | 4 | 5 | 6
      headings.push({ level, text: atx[2].trim(), line: i + 1, index: index++ })
      continue
    }

    if (i + 1 < lines.length && line.trim().length > 0) {
      const next = lines[i + 1]
      if (/^=+\s*$/.test(next)) {
        headings.push({ level: 1, text: line.trim(), line: i + 1, index: index++ })
      } else if (/^-+\s*$/.test(next) && next.trim().length >= 2) {
        headings.push({ level: 2, text: line.trim(), line: i + 1, index: index++ })
      }
    }
  }

  return headings
}
