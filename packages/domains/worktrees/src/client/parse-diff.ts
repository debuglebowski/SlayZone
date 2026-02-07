export interface DiffLine {
  type: 'add' | 'delete' | 'context'
  content: string
  oldLineNo: number | null
  newLineNo: number | null
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
}

const HUNK_HEADER = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/

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
      isDeleted: false
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
        } else if (raw.startsWith('-')) {
          hunk.lines.push({ type: 'delete', content: raw.slice(1), oldLineNo: oldLine++, newLineNo: null })
        } else if (raw.startsWith(' ')) {
          hunk.lines.push({ type: 'context', content: raw.slice(1), oldLineNo: oldLine++, newLineNo: newLine++ })
        } else if (raw.startsWith('\\')) {
          // "\ No newline at end of file" — skip
        }
        i++
      }

      fileDiff.hunks.push(hunk)
    }

    files.push(fileDiff)
  }

  return files
}
