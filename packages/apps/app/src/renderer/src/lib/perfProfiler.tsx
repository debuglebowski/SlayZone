import React, { Profiler, type ProfilerOnRenderCallback, type ReactNode } from 'react'

declare const __SLAYZONE_PROFILE__: boolean

export interface ProfilerCommit {
  id: string
  phase: 'mount' | 'update' | 'nested-update'
  actualDuration: number
  baseDuration: number
  startTime: number
  commitTime: number
}

declare global {
  interface Window {
    __slayzone_profiler__?: {
      commits: ProfilerCommit[]
      max: number
      enabled: boolean
      reset: () => void
      snapshot: () => ProfilerCommit[]
    }
  }
}

const MAX_COMMITS = 1000

function initBuffer() {
  if (typeof window === 'undefined') return
  if (window.__slayzone_profiler__) return
  const commits: ProfilerCommit[] = []
  // Default disabled — devs running a SLAYZONE_PROFILE=1 build pay only the
  // (small) cost of having Profiler in the tree, not the per-commit recording.
  // The harness flips `enabled = true` for the duration of each iteration.
  window.__slayzone_profiler__ = {
    commits,
    max: MAX_COMMITS,
    enabled: false,
    reset: () => {
      commits.length = 0
    },
    snapshot: () => commits.slice()
  }
}

const onRender: ProfilerOnRenderCallback = (id, phase, actualDuration, baseDuration, startTime, commitTime) => {
  const buf = window.__slayzone_profiler__
  if (!buf || !buf.enabled) return
  if (buf.commits.length >= buf.max) buf.commits.shift()
  buf.commits.push({ id, phase: phase as ProfilerCommit['phase'], actualDuration, baseDuration, startTime, commitTime })
}

export function MaybeProfiler({ children }: { children: ReactNode }): React.JSX.Element {
  if (!__SLAYZONE_PROFILE__) return <>{children}</>
  initBuffer()
  return <Profiler id="app" onRender={onRender}>{children}</Profiler>
}
