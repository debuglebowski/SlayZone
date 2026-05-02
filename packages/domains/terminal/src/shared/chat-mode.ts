/**
 * Chat permission/operating mode shared by main + client. Stored in
 * `provider_config.<terminalMode>.chatMode`. The full set of CLI permission
 * modes accepted by `claude --permission-mode <X>` is wider — `default` and
 * `dontAsk` are deliberately not exposed here because chat has no interactive
 * prompt mechanism, so those values would either hang or no-op.
 */
export type ChatMode = 'plan' | 'auto-accept' | 'auto' | 'bypass'

/**
 * Map a raw `claude` CLI permission mode (as observed in `system/init.permissionMode`)
 * to our exposed `ChatMode`. Returns null for unmapped values (`default`, `dontAsk`)
 * so callers can decide whether to leave existing state untouched. Subprocess is the
 * source of truth: this mapper translates its raw value into our enum.
 */
export function rawPermissionModeToChatMode(raw: string | null | undefined): ChatMode | null {
  switch (raw) {
    case 'plan': return 'plan'
    case 'acceptEdits': return 'auto-accept'
    case 'auto': return 'auto'
    case 'bypassPermissions': return 'bypass'
    default: return null
  }
}

/** Inverse: produce CLI flags for a given ChatMode. */
export function chatModeToFlags(mode: ChatMode): string[] {
  switch (mode) {
    case 'plan': return ['--permission-mode', 'plan']
    case 'auto-accept': return ['--permission-mode', 'acceptEdits']
    case 'auto': return ['--permission-mode', 'auto']
    case 'bypass': return ['--allow-dangerously-skip-permissions']
  }
}
