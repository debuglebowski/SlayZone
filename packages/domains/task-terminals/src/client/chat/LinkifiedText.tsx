import React from 'react'
import { findLinksInString } from '@slayzone/terminal/shared'
import { Tooltip, TooltipContent, TooltipTrigger } from '@slayzone/ui'

interface LinkifiedTextProps {
  text: string
  /** Cmd/Ctrl+click on a URL → open externally. Defaults to `window.api.shell.openExternal`. */
  onOpenUrl?: (url: string) => void
  /** Cmd/Ctrl+click on a file path → open in editor pane. Defaults to `window.api.shell.openPath`. */
  onOpenFile?: (path: string, line?: number, col?: number) => void
}

function defaultOpenUrl(url: string): void {
  const api = (window as unknown as { api?: { shell?: { openExternal: (u: string) => Promise<unknown> } } }).api
  void api?.shell?.openExternal(url)
}

function defaultOpenFile(path: string): void {
  const api = (window as unknown as { api?: { shell?: { openPath: (p: string) => Promise<string> } } }).api
  void api?.shell?.openPath(path)
}

/**
 * Plain-text renderer that detects URLs + file:line:col references using the
 * shared regex helpers, wraps each match in an anchor element with a Radix
 * tooltip, and routes clicks to the appropriate handler.
 *
 * Modifier-aware: `Cmd/Ctrl+Click` invokes the handler. Bare clicks let the
 * caller decide (e.g. select text). This mirrors xterm web-link behavior.
 */
export function LinkifiedText({ text, onOpenUrl, onOpenFile }: LinkifiedTextProps) {
  const matches = findLinksInString(text)
  if (matches.length === 0) return <>{text}</>

  const out: React.ReactNode[] = []
  let cursor = 0
  let key = 0
  for (const m of matches) {
    if (m.start > cursor) out.push(<React.Fragment key={`t${key++}`}>{text.slice(cursor, m.start)}</React.Fragment>)
    const isUrl = m.kind === 'url'
    const handleClick = (e: React.MouseEvent): void => {
      // Modifier-required to avoid hijacking text selection.
      if (!e.metaKey && !e.ctrlKey) return
      e.preventDefault()
      if (isUrl) (onOpenUrl ?? defaultOpenUrl)(m.text)
      else if (m.filePath) (onOpenFile ?? defaultOpenFile)(m.filePath, m.line, m.col)
    }
    const label = isUrl ? m.text : `${m.filePath}${m.line ? `:${m.line}${m.col ? `:${m.col}` : ''}` : ''}`
    out.push(
      <Tooltip key={`l${key++}`}>
        <TooltipTrigger asChild>
          <a
            href={isUrl ? m.text : '#'}
            onClick={handleClick}
            className="text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary cursor-pointer"
          >
            {m.text}
          </a>
        </TooltipTrigger>
        <TooltipContent side="top" className="font-mono text-[11px]">
          {isUrl ? 'Cmd+Click to open' : `Cmd+Click to open: ${label}`}
        </TooltipContent>
      </Tooltip>
    )
    cursor = m.end
  }
  if (cursor < text.length) out.push(<React.Fragment key={`t${key++}`}>{text.slice(cursor)}</React.Fragment>)
  return <>{out}</>
}
