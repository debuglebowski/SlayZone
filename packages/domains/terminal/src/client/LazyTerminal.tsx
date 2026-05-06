import { lazy, Suspense, forwardRef } from 'react'
import type { TerminalHandle, TerminalProps } from './Terminal'

// Lazy-load wrapper. Defers ~440KB of xterm + addons + xterm.css off the
// main bundle into its own chunk. First Terminal mount fetches the chunk
// from disk (file://, no network) — perceived as a brief blank cell while
// the chunk parses, then the real terminal mounts.
//
// Idle prefetch is wired in App.tsx after dataReady so the chunk is usually
// already warm by the time the user opens a terminal panel.
const TerminalImpl = lazy(() =>
  import('./Terminal').then((m) => ({ default: m.Terminal }))
)

export const Terminal = forwardRef<TerminalHandle, TerminalProps>(function LazyTerminal(props, ref) {
  return (
    <Suspense fallback={<div className="h-full w-full bg-background" />}>
      <TerminalImpl {...props} ref={ref} />
    </Suspense>
  )
})

export type { TerminalHandle, TerminalProps }
