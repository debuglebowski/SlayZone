export interface InlineHighlight {
  start: number
  end: number
}

export interface DiffLine {
  type: 'add' | 'delete' | 'context'
  content: string
  oldLineNo: number | null
  newLineNo: number | null
  highlights?: InlineHighlight[]
}

export interface DiffHunk {
  header: string
  oldStart: number
  newStart: number
  lines: DiffLine[]
}

export interface FileDiff {
  path: string
  oldPath: string | null
  hunks: DiffHunk[]
  isBinary: boolean
  isNew: boolean
  isDeleted: boolean
  additions: number
  deletions: number
}

const HUNK_HEADER = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/

export function computeInlineHighlights(
  oldContent: string,
  newContent: string
): { oldHighlights: InlineHighlight[]; newHighlights: InlineHighlight[] } {
  const empty = { oldHighlights: [], newHighlights: [] }

  // Skip if lines are too different (less than 30% common)
  const maxLen = Math.max(oldContent.length, newContent.length)
  if (maxLen === 0) return empty

  // Find common prefix
  let prefixLen = 0
  const minLen = Math.min(oldContent.length, newContent.length)
  while (prefixLen < minLen && oldContent[prefixLen] === newContent[prefixLen]) {
    prefixLen++
  }

  // Find common suffix (not overlapping prefix)
  let suffixLen = 0
  while (
    suffixLen < minLen - prefixLen &&
    oldContent[oldContent.length - 1 - suffixLen] === newContent[newContent.length - 1 - suffixLen]
  ) {
    suffixLen++
  }

  const commonLen = prefixLen + suffixLen
  // If less than 30% is common, don't highlight — lines are too different
  if (commonLen < maxLen * 0.3) return empty
  // If everything is common (identical lines), nothing to highlight
  if (commonLen >= maxLen) return empty

  const oldStart = prefixLen
  const oldEnd = oldContent.length - suffixLen
  const newStart = prefixLen
  const newEnd = newContent.length - suffixLen

  return {
    oldHighlights: oldEnd > oldStart ? [{ start: oldStart, end: oldEnd }] : [],
    newHighlights: newEnd > newStart ? [{ start: newStart, end: newEnd }] : []
  }
}

function applyInlineHighlights(hunks: DiffHunk[]): void {
  for (const hunk of hunks) {
    const lines = hunk.lines
    let i = 0
    while (i < lines.length) {
      // Find a block of consecutive deletes followed by consecutive adds
      const delStart = i
      while (i < lines.length && lines[i].type === 'delete') i++
      const delEnd = i
      const addStart = i
      while (i < lines.length && lines[i].type === 'add') i++
      const addEnd = i

      const delCount = delEnd - delStart
      const addCount = addEnd - addStart

      // Pair up to min(del, add) lines for highlighting
      if (delCount > 0 && addCount > 0) {
        const pairCount = Math.min(delCount, addCount)
        for (let j = 0; j < pairCount; j++) {
          const { oldHighlights, newHighlights } = computeInlineHighlights(
            lines[delStart + j].content,
            lines[addStart + j].content
          )
          lines[delStart + j].highlights = oldHighlights.length > 0 ? oldHighlights : undefined
          lines[addStart + j].highlights = newHighlights.length > 0 ? newHighlights : undefined
        }
      }

      // Skip context lines
      if (i === delStart) i++
    }
  }
}

export function parseUnifiedDiff(patch: string): FileDiff[] {
  if (!patch.trim()) return []

  const files: FileDiff[] = []
  // Split into per-file chunks
  const chunks = patch.split(/\n(?=diff --git )/)

  for (const chunk of chunks) {
    if (!chunk.startsWith('diff --git ')) continue

    const lines = chunk.split('\n')
    const headerMatch = lines[0].match(/^diff --git a\/(.+?) b\/(.+)$/)
    if (!headerMatch) continue

    const oldPath = headerMatch[1]
    const newPath = headerMatch[2]

    const fileDiff: FileDiff = {
      path: newPath,
      oldPath: oldPath !== newPath ? oldPath : null,
      hunks: [],
      isBinary: false,
      isNew: false,
      isDeleted: false,
      additions: 0,
      deletions: 0
    }

    let i = 1
    // Parse file header lines (before hunks)
    while (i < lines.length && !lines[i].startsWith('@@')) {
      const line = lines[i]
      if (line.startsWith('new file mode')) fileDiff.isNew = true
      else if (line.startsWith('deleted file mode')) fileDiff.isDeleted = true
      else if (line.startsWith('Binary files')) {
        fileDiff.isBinary = true
        break
      }
      i++
    }

    if (fileDiff.isBinary) {
      files.push(fileDiff)
      continue
    }

    // Parse hunks
    while (i < lines.length) {
      const hunkMatch = lines[i].match(HUNK_HEADER)
      if (!hunkMatch) {
        i++
        continue
      }

      const hunk: DiffHunk = {
        header: lines[i],
        oldStart: parseInt(hunkMatch[1], 10),
        newStart: parseInt(hunkMatch[2], 10),
        lines: []
      }

      let oldLine = hunk.oldStart
      let newLine = hunk.newStart
      i++

      while (i < lines.length && !lines[i].startsWith('@@') && !lines[i].startsWith('diff --git ')) {
        const raw = lines[i]
        if (raw.startsWith('+')) {
          hunk.lines.push({ type: 'add', content: raw.slice(1), oldLineNo: null, newLineNo: newLine++ })
          fileDiff.additions++
        } else if (raw.startsWith('-')) {
          hunk.lines.push({ type: 'delete', content: raw.slice(1), oldLineNo: oldLine++, newLineNo: null })
          fileDiff.deletions++
        } else if (raw.startsWith(' ')) {
          hunk.lines.push({ type: 'context', content: raw.slice(1), oldLineNo: oldLine++, newLineNo: newLine++ })
        } else if (raw.startsWith('\\')) {
          // "\ No newline at end of file" — skip
        }
        i++
      }

      fileDiff.hunks.push(hunk)
    }

    applyInlineHighlights(fileDiff.hunks)
    files.push(fileDiff)
  }

  return files
}
