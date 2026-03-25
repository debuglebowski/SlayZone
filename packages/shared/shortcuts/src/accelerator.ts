import { detectPlatform, type Platform } from './platform'

const DISPLAY_MAP_MAC: Record<string, string> = {
  mod: '⌘', shift: '⇧', alt: '⌥', ctrl: '⌃',
}
const DISPLAY_MAP_OTHER: Record<string, string> = {
  mod: 'Ctrl', shift: 'Shift', alt: 'Alt', ctrl: 'Ctrl',
}

export function formatKeysForDisplay(keys: string, platform?: Platform): string {
  const map = (platform ?? detectPlatform()) === 'mac' ? DISPLAY_MAP_MAC : DISPLAY_MAP_OTHER
  return keys.split('+').map(part => {
    const mapped = map[part]
    if (mapped) return mapped
    return part.length === 1 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1)
  }).join(' ')
}

export function toElectronAccelerator(keys: string): string {
  return keys.split('+').map(part => {
    if (part === 'mod') return 'CmdOrCtrl'
    if (part === 'shift') return 'Shift'
    if (part === 'alt') return 'Alt'
    if (part === 'ctrl') return 'Ctrl'
    return part.length === 1 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1)
  }).join('+')
}

/**
 * Check if a KeyboardEvent matches a shortcut string like "mod+g" or "mod+shift+g".
 * Used by raw keydown handlers that can't use react-hotkeys-hook.
 */
export function matchesShortcut(e: KeyboardEvent, keys: string): boolean {
  const parts = keys.split('+')
  const key = parts[parts.length - 1]
  const wantMod = parts.includes('mod')
  const wantShift = parts.includes('shift')
  const wantAlt = parts.includes('alt')
  const wantCtrl = parts.includes('ctrl')

  const isMac = detectPlatform() === 'mac'

  if (isMac) {
    if (wantMod !== e.metaKey) return false
    if (wantCtrl !== e.ctrlKey) return false
  } else {
    if ((wantMod || wantCtrl) !== e.ctrlKey) return false
    if (e.metaKey) return false
  }
  if (wantShift !== e.shiftKey) return false
  if (wantAlt !== e.altKey) return false

  return e.key.toLowerCase() === key
}

/** Electron's before-input-event Input shape (subset we need). */
export interface ElectronInput {
  type: string
  key: string
  meta: boolean
  control: boolean
  shift: boolean
  alt: boolean
}

/**
 * Check if an Electron before-input-event Input matches a shortcut string.
 * Same logic as matchesShortcut but for Electron's Input type.
 */
export function matchesElectronInput(input: ElectronInput, keys: string): boolean {
  if (input.type !== 'keyDown') return false

  const parts = keys.split('+')
  const key = parts[parts.length - 1]
  const wantMod = parts.includes('mod')
  const wantShift = parts.includes('shift')
  const wantAlt = parts.includes('alt')
  const wantCtrl = parts.includes('ctrl')

  const isMac = detectPlatform() === 'mac'

  if (isMac) {
    if (wantMod !== input.meta) return false
    if (wantCtrl !== input.control) return false
  } else {
    if ((wantMod || wantCtrl) !== input.control) return false
    if (input.meta) return false
  }
  if (wantShift !== input.shift) return false
  if (wantAlt !== input.alt) return false

  return input.key.toLowerCase() === key
}
