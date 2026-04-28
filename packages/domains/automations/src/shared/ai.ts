import type { AiActionParams } from './types'

/**
 * Headless command pattern for each known provider type.
 *
 * `{prompt}` is replaced with a single-quote-escaped prompt. `{flags}` is
 * replaced with raw flags (or empty string). Patterns target one-shot,
 * non-interactive invocations of each provider's CLI.
 */
const HEADLESS_PATTERNS: Record<string, string> = {
  'claude-code': "claude -p {prompt} {flags}",
  'codex': "codex exec {flags} {prompt}",
  'gemini': "gemini -p {prompt} {flags}",
  'cursor-agent': "cursor-agent -p {prompt} {flags}",
  'opencode': "opencode run {flags} {prompt}",
  'qwen-code': "qwen -p {prompt} {flags}",
  'copilot': "copilot -p {prompt} {flags}",
}

export interface ProviderInfo {
  id: string
  type: string
  defaultFlags?: string | null
}

/**
 * Single-quote escape for POSIX shell. Wraps the value in single quotes and
 * escapes any embedded single quote by closing, escaping, reopening: a'b -> 'a'\''b'
 */
export function shellSingleQuote(value: unknown): string {
  const s = typeof value === 'string' ? value : value == null ? '' : String(value)
  return `'${s.replace(/'/g, `'\\''`)}'`
}

export function getHeadlessPattern(providerType: string): string | null {
  return HEADLESS_PATTERNS[providerType] ?? null
}

/**
 * Build the headless CLI command for an AI action. Returns null if the
 * provider type has no known headless pattern (e.g. plain `terminal`).
 */
export function buildAiHeadlessCommand(
  params: AiActionParams,
  provider: ProviderInfo,
): string | null {
  const pattern = HEADLESS_PATTERNS[provider.type]
  if (!pattern) return null
  // Empty/whitespace-only flags fall back to the provider's default — the
  // dialog stores `flags: ''` for newly-added AI actions, so treating empty
  // as "use default" matches user expectations.
  const flags = (params.flags?.trim() || provider.defaultFlags?.trim() || '')
  return pattern
    .replace('{prompt}', shellSingleQuote(params.prompt))
    .replace('{flags}', flags)
    .replace(/\s+/g, ' ')
    .trim()
}
