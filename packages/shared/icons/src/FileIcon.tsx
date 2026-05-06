import { useEffect, useState } from 'react'
import { getFileIconSvg, getFileIconSvgAsync } from './file-icons'

function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\bon\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\bon\w+\s*=\s*'[^']*'/gi, '')
}

interface FileIconProps {
  fileName: string
  className?: string
}

export function FileIcon({ fileName, className }: FileIconProps) {
  // Sync path when chunk already loaded (idle prefetch + cache hit).
  // Async path on first miss — placeholder span until chunk lands.
  const [svg, setSvg] = useState<string | null>(() => getFileIconSvg(fileName))

  useEffect(() => {
    if (svg !== null) return
    let cancelled = false
    getFileIconSvgAsync(fileName).then((s) => {
      if (!cancelled) setSvg(s)
    }).catch(() => {/* keep placeholder */})
    return () => { cancelled = true }
  }, [fileName, svg])

  if (svg === null) return <span className={className} />
  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitizeSvg(svg) }}
    />
  )
}
