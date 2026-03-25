export { detectPlatform, type Platform } from './platform'
export {
  shortcutDefinitions,
  MENU_SHORTCUT_DEFAULTS,
  type ShortcutDefinition,
  type ShortcutScope,
} from './definitions'
export { toElectronAccelerator, matchesShortcut, matchesElectronInput, formatKeysForDisplay, type ElectronInput } from './accelerator'
