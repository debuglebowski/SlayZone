import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { shallow } from 'zustand/shallow'
import type { ConfigLevel } from '../shared'

interface ContextManagerViewState {
  // Navigation
  activeLevel: ConfigLevel
  activeSection: string

  // Skills
  skillViewMode: Record<string, 'list' | 'graph'>

  // Global files
  globalSelectedPath: string | null
  globalSplitWidth: number

  // Project context tree
  projectSelectedPath: string | null
  projectExpandedFolders: string[]
  projectSplitWidth: number

  // Skill editor panel (null = 50% of available)
  skillEditorWidth: number | null

  // File tree display toggles
  showBlobs: boolean
  showLineCount: boolean

  // Hydration
  isLoaded: boolean

  // Actions
  setActive: (level: ConfigLevel, section: string) => void
  setSkillViewMode: (scope: string, mode: 'list' | 'graph') => void
  setGlobalSelectedPath: (path: string | null) => void
  setGlobalSplitWidth: (width: number) => void
  setProjectSelectedPath: (path: string | null) => void
  setProjectExpandedFolders: (folders: string[]) => void
  setProjectSplitWidth: (width: number) => void
  setSkillEditorWidth: (width: number | null) => void
  setShowBlobs: (show: boolean) => void
  setShowLineCount: (show: boolean) => void
  _loadState: (persisted: Partial<PersistedState>) => void
}

/** Only these fields are persisted to the database */
interface PersistedState {
  activeLevel: ConfigLevel
  activeSection: string
  skillViewMode: Record<string, 'list' | 'graph'>
  globalSelectedPath: string | null
  globalSplitWidth: number
  projectSelectedPath: string | null
  projectExpandedFolders: string[]
  projectSplitWidth: number
  skillEditorWidth: number | null
  showBlobs: boolean
  showLineCount: boolean
}

const DEFAULTS: PersistedState = {
  activeLevel: 'computer',
  activeSection: 'files',
  skillViewMode: {},
  globalSelectedPath: null,
  globalSplitWidth: 350,
  projectSelectedPath: null,
  projectExpandedFolders: [],
  projectSplitWidth: 350,
  skillEditorWidth: null,
  showBlobs: true,
  showLineCount: true,
}

export const useContextManagerStore = create<ContextManagerViewState>()(
  subscribeWithSelector((set) => ({
    ...DEFAULTS,
    isLoaded: false,

    setActive: (level, section) => set({ activeLevel: level, activeSection: section }),
    setSkillViewMode: (scope, mode) =>
      set((s) => ({ skillViewMode: { ...s.skillViewMode, [scope]: mode } })),
    setGlobalSelectedPath: (path) => set({ globalSelectedPath: path }),
    setGlobalSplitWidth: (width) => set({ globalSplitWidth: width }),
    setProjectSelectedPath: (path) => set({ projectSelectedPath: path }),
    setProjectExpandedFolders: (folders) => set({ projectExpandedFolders: folders }),
    setProjectSplitWidth: (width) => set({ projectSplitWidth: width }),
    setSkillEditorWidth: (width) => set({ skillEditorWidth: width }),
    setShowBlobs: (show) => set({ showBlobs: show }),
    setShowLineCount: (show) => set({ showLineCount: show }),

    _loadState: (persisted) => set({ ...DEFAULTS, ...persisted, isLoaded: true }),
  }))
)

// --- Eager hydration at module scope (same pattern as useTabStore) ---

const DB_KEY = 'context_manager_view_state'

export const contextManagerStoreReady: Promise<void> =
  typeof window !== 'undefined' && window.api?.settings
    ? window.api.settings
        .get(DB_KEY)
        .then((value) => {
          if (value) {
            try {
              useContextManagerStore.getState()._loadState(JSON.parse(value))
            } catch {
              useContextManagerStore.setState({ isLoaded: true })
            }
          } else {
            useContextManagerStore.setState({ isLoaded: true })
          }
        })
        .catch(() => {
          useContextManagerStore.setState({ isLoaded: true })
        })
    : Promise.resolve()

// --- Debounced persistence ---

let _debounceTimer: ReturnType<typeof setTimeout> | null = null

function pickPersisted(state: ContextManagerViewState): PersistedState {
  return {
    activeLevel: state.activeLevel,
    activeSection: state.activeSection,
    skillViewMode: state.skillViewMode,
    globalSelectedPath: state.globalSelectedPath,
    globalSplitWidth: state.globalSplitWidth,
    projectSelectedPath: state.projectSelectedPath,
    projectExpandedFolders: state.projectExpandedFolders,
    projectSplitWidth: state.projectSplitWidth,
    skillEditorWidth: state.skillEditorWidth,
    showBlobs: state.showBlobs,
    showLineCount: state.showLineCount,
  }
}

useContextManagerStore.subscribe(
  pickPersisted,
  (slice) => {
    if (!useContextManagerStore.getState().isLoaded) return
    if (_debounceTimer) clearTimeout(_debounceTimer)
    _debounceTimer = setTimeout(() => {
      window.api.settings.set(DB_KEY, JSON.stringify(slice))
    }, 500)
  },
  { equalityFn: shallow }
)
