import { create } from 'zustand'
import { shortcutDefinitions, type ShortcutDefinition, type ShortcutScope } from '@slayzone/ui'

const SETTINGS_KEY = 'custom_shortcuts'

interface ShortcutState {
  overrides: Record<string, string>
  isRecording: boolean
  loaded: boolean
  load: () => Promise<void>
  getKeys: (id: string) => string
  isCustomized: (id: string) => boolean
  findConflict: (keys: string, scope: ShortcutScope) => ShortcutDefinition | undefined
  setOverride: (id: string, keys: string) => Promise<void>
  removeOverride: (id: string) => Promise<void>
  resetAll: () => Promise<void>
  setRecording: (recording: boolean) => void
}

export const useShortcutStore = create<ShortcutState>((set, get) => ({
  overrides: {},
  isRecording: false,
  loaded: false,

  load: async () => {
    const raw = await window.api.settings.get(SETTINGS_KEY)
    if (raw) {
      try {
        set({ overrides: JSON.parse(raw), loaded: true })
      } catch {
        set({ loaded: true })
      }
    } else {
      set({ loaded: true })
    }
  },

  getKeys: (id: string) => {
    const { overrides } = get()
    if (overrides[id]) return overrides[id]
    const def = shortcutDefinitions.find((d) => d.id === id)
    return def?.defaultKeys ?? ''
  },

  isCustomized: (id: string) => {
    return id in get().overrides
  },

  findConflict: (keys: string, scope: ShortcutScope) => {
    const { overrides } = get()
    return shortcutDefinitions.find((d) => {
      if (d.scope !== scope) return false
      const effective = overrides[d.id] ?? d.defaultKeys
      return effective === keys
    })
  },

  setOverride: async (id: string, keys: string) => {
    const newOverrides = { ...get().overrides, [id]: keys }
    set({ overrides: newOverrides })
    await window.api.settings.set(SETTINGS_KEY, JSON.stringify(newOverrides))
    window.api.shortcuts.changed()
  },

  removeOverride: async (id: string) => {
    const { [id]: _, ...rest } = get().overrides
    set({ overrides: rest })
    const value = Object.keys(rest).length === 0 ? '{}' : JSON.stringify(rest)
    await window.api.settings.set(SETTINGS_KEY, value)
    window.api.shortcuts.changed()
  },

  resetAll: async () => {
    set({ overrides: {} })
    await window.api.settings.set(SETTINGS_KEY, '{}')
    window.api.shortcuts.changed()
  },

  setRecording: (recording: boolean) => set({ isRecording: recording })
}))
