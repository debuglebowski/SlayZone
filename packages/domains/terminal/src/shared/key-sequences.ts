/**
 * Wire bytes for terminal key events. Shared between renderer (xterm key
 * handlers) and main (adapter encodeSubmit). One source so the same constant
 * never drifts between caller-side replicas.
 */

/** Carriage return — fires Enter on raw-mode TUIs (Ink, Bubble Tea, etc).
 *  LF (`\n`, 0x0A) is Ctrl+J on raw stdin and is treated as newline-in-input
 *  by most readline-style libraries — do NOT use for submit. */
export const ENTER = '\r'

/** Kitty keyboard protocol CSI u: keycode 13 (Enter), modifier 2 (Shift).
 *  Apps that opt in via `CSI > 1 u` recognize this as Shift+Enter, used to
 *  insert a newline within a multi-line input (instead of submitting). */
export const KITTY_SHIFT_ENTER = '\x1b[13;2u'
