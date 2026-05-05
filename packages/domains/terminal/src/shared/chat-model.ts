/**
 * Claude model the chat subprocess targets. `default` = inherit account default
 * (no `--model` flag). Stored in `provider_config.<terminalMode>.chatModel`.
 *
 * Mirrors the `claude --model` CLI accepted aliases. Full Anthropic ids
 * (`claude-sonnet-4-5-...`) also work but the alias keeps task DB stable
 * across model rev-bumps.
 */
export type ChatModel = 'default' | 'sonnet' | 'opus' | 'haiku'

/** Concrete resolved model — never `'default'`. Used to describe what the
 * Claude account default actually is (e.g. `~/.claude/settings.json` `model`). */
export type ResolvedChatModel = Exclude<ChatModel, 'default'>

export const CHAT_MODELS: ChatModel[] = ['default', 'sonnet', 'opus', 'haiku']

export const DEFAULT_CHAT_MODEL: ChatModel = 'default'

/** Fallback when account default cannot be determined from settings. */
export const FALLBACK_ACCOUNT_DEFAULT_MODEL: ResolvedChatModel = 'opus'

/** CLI flags for a given ChatModel. `default` emits none → CLI picks. */
export function chatModelToFlags(model: ChatModel): string[] {
  return model === 'default' ? [] : ['--model', model]
}

export function isChatModel(v: unknown): v is ChatModel {
  return typeof v === 'string' && (CHAT_MODELS as string[]).includes(v)
}

/**
 * Map a raw `model` string from `~/.claude/settings.json` (or similar) to
 * one of our concrete aliases. Accepts shortform aliases (`opus`, `sonnet`,
 * `haiku`) and full ids (`claude-opus-4-7`, `claude-3-5-sonnet-20241022`).
 * Returns `FALLBACK_ACCOUNT_DEFAULT_MODEL` for unknown / null / unparseable.
 */
export function normalizeAccountModel(raw: string | null | undefined): ResolvedChatModel {
  if (!raw || typeof raw !== 'string') return FALLBACK_ACCOUNT_DEFAULT_MODEL
  const s = raw.toLowerCase()
  if (s.includes('opus')) return 'opus'
  if (s.includes('sonnet')) return 'sonnet'
  if (s.includes('haiku')) return 'haiku'
  return FALLBACK_ACCOUNT_DEFAULT_MODEL
}
