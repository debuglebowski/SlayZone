/**
 * Claude model the chat subprocess targets. `default` = inherit account default
 * (no `--model` flag). Stored in `provider_config.<terminalMode>.chatModel`.
 *
 * Mirrors the `claude --model` CLI accepted aliases. Full Anthropic ids
 * (`claude-sonnet-4-5-...`) also work but the alias keeps task DB stable
 * across model rev-bumps.
 */
export type ChatModel = 'default' | 'sonnet' | 'opus' | 'haiku'

export const CHAT_MODELS: ChatModel[] = ['default', 'sonnet', 'opus', 'haiku']

export const DEFAULT_CHAT_MODEL: ChatModel = 'default'

/** CLI flags for a given ChatModel. `default` emits none → CLI picks. */
export function chatModelToFlags(model: ChatModel): string[] {
  return model === 'default' ? [] : ['--model', model]
}

export function isChatModel(v: unknown): v is ChatModel {
  return typeof v === 'string' && (CHAT_MODELS as string[]).includes(v)
}
