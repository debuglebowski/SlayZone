import type { CSSProperties } from 'react'

/** Shared chart styling and utilities */

export function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export const PROVIDER_COLORS: Record<string, string> = {
  'claude-code': '#d97706',
  codex: '#2563eb',
  opencode: '#16a34a'
}

export const PROVIDER_FALLBACK_COLOR = '#6b7280'

/** Matches the app's TooltipContent: bg-foreground text-background */
export const TOOLTIP_STYLE: CSSProperties = {
  fontSize: 12,
  borderRadius: 8,
  border: 'none',
  background: 'var(--foreground)',
  color: 'var(--background)',
  padding: '6px 12px'
}

export const TICK_STYLE = {
  fontSize: 11,
  fill: 'var(--muted-foreground)'
}

export const GRID_STYLE = {
  stroke: 'var(--border)'
}
