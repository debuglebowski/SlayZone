import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDialogStore, useSetting, useSetSettingMutation } from '@slayzone/settings'

const CHECKLIST_SETTINGS_KEY = 'onboarding_checklist_state'
const CHECKLIST_STATE_VERSION = 1 as const

interface PersistedChecklistStateV1 {
  version: typeof CHECKLIST_STATE_VERSION
  dismissed: boolean
  completed: {
    setupGuide: boolean
    takeTour: boolean
    checkLeaderboard: boolean
    joinCommunity: boolean
    followOnX: boolean
  }
}

const DEFAULT_PERSISTED_STATE: PersistedChecklistStateV1 = {
  version: CHECKLIST_STATE_VERSION,
  dismissed: false,
  completed: {
    setupGuide: false,
    takeTour: false,
    checkLeaderboard: false,
    joinCommunity: false,
    followOnX: false
  }
}

export interface OnboardingChecklistStep {
  id: string
  label: string
  completed: boolean
  disabled?: boolean
  allowWhenCompleted?: boolean
  onClick: () => void
}

export interface OnboardingChecklistState {
  steps: OnboardingChecklistStep[]
  dismissed: boolean
  remainingCount: number
  hasRemaining: boolean
  onDismiss: () => void
}

interface UseOnboardingChecklistOptions {
  projectCount: number
  hasCreatedTask: boolean
  onCheckLeaderboard: () => void
  onJoinCommunity: () => void
  onFollowOnX: () => void
}

interface UseOnboardingChecklistResult {
  checklist: OnboardingChecklistState
  startTour: () => void
  markSetupGuideCompleted: () => void
}

function isTruthy(value: string | null | undefined): boolean {
  return value === '1' || value === 'true'
}

function isPersistedChecklistStateV1(value: unknown): value is PersistedChecklistStateV1 {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<PersistedChecklistStateV1>
  if (candidate.version !== CHECKLIST_STATE_VERSION || typeof candidate.dismissed !== 'boolean') return false
  if (!candidate.completed || typeof candidate.completed !== 'object') return false

  const completed = candidate.completed as Partial<PersistedChecklistStateV1['completed']>
  return (
    typeof completed.setupGuide === 'boolean' &&
    typeof completed.takeTour === 'boolean' &&
    typeof completed.joinCommunity === 'boolean' &&
    typeof completed.followOnX === 'boolean' &&
    (completed.checkLeaderboard === undefined || typeof completed.checkLeaderboard === 'boolean')
  )
}

function parsePersistedChecklistState(raw: string | null | undefined): PersistedChecklistStateV1 | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isPersistedChecklistStateV1(parsed)) return null
    // Default checkLeaderboard for existing persisted state without it
    if (parsed.completed.checkLeaderboard === undefined) {
      parsed.completed.checkLeaderboard = false
    }
    return parsed
  } catch {
    return null
  }
}

function areStatesEqual(left: PersistedChecklistStateV1, right: PersistedChecklistStateV1): boolean {
  return (
    left.dismissed === right.dismissed &&
    left.completed.setupGuide === right.completed.setupGuide &&
    left.completed.takeTour === right.completed.takeTour &&
    left.completed.checkLeaderboard === right.completed.checkLeaderboard &&
    left.completed.joinCommunity === right.completed.joinCommunity &&
    left.completed.followOnX === right.completed.followOnX
  )
}

export function useOnboardingChecklist({
  projectCount,
  hasCreatedTask,
  onCheckLeaderboard,
  onJoinCommunity,
  onFollowOnX
}: UseOnboardingChecklistOptions): UseOnboardingChecklistResult {
  const setSetting = useSetSettingMutation()
  const storedRaw = useSetting(CHECKLIST_SETTINGS_KEY)

  // Legacy keys — only consulted when the consolidated key has no value yet.
  const legacySetupGuide = useSetting('onboarding_completed')
  const legacyTour = useSetting('onboarding_tour_completed')
  const legacyJoinDiscord = useSetting('onboarding_joined_discord')
  const legacyFollowedX = useSetting('onboarding_followed_x')
  const legacyDismissed = useSetting('onboarding_checklist_dismissed')

  const [persistedState, setPersistedState] = useState<PersistedChecklistStateV1>(DEFAULT_PERSISTED_STATE)
  const [hydrated, setHydrated] = useState(false)

  // Hydrate from the consolidated key if present; otherwise migrate from legacy keys
  // and write the consolidated key once. Runs once after queries resolve.
  useEffect(() => {
    if (hydrated) return
    if (storedRaw === undefined) return
    const stored = parsePersistedChecklistState(storedRaw)
    if (stored) {
      setPersistedState(stored)
      setHydrated(true)
      return
    }
    if (
      legacySetupGuide === undefined ||
      legacyTour === undefined ||
      legacyJoinDiscord === undefined ||
      legacyFollowedX === undefined ||
      legacyDismissed === undefined
    ) {
      return
    }
    const dismissed = isTruthy(legacyDismissed)
    const migrated: PersistedChecklistStateV1 = dismissed
      ? {
          version: CHECKLIST_STATE_VERSION,
          dismissed: true,
          completed: {
            setupGuide: true,
            takeTour: true,
            checkLeaderboard: true,
            joinCommunity: true,
            followOnX: true,
          },
        }
      : {
          version: CHECKLIST_STATE_VERSION,
          dismissed: false,
          completed: {
            setupGuide: isTruthy(legacySetupGuide),
            takeTour: isTruthy(legacyTour),
            checkLeaderboard: false,
            joinCommunity: isTruthy(legacyJoinDiscord),
            followOnX: isTruthy(legacyFollowedX),
          },
        }
    setPersistedState(migrated)
    setHydrated(true)
    setSetting.mutate({ key: CHECKLIST_SETTINGS_KEY, value: JSON.stringify(migrated) })
  }, [hydrated, storedRaw, legacySetupGuide, legacyTour, legacyJoinDiscord, legacyFollowedX, legacyDismissed, setSetting])

  const updatePersistedState = useCallback((updater: (previous: PersistedChecklistStateV1) => PersistedChecklistStateV1): void => {
    setPersistedState((previous) => {
      const next = updater(previous)
      if (areStatesEqual(previous, next)) return previous
      setSetting.mutate({ key: CHECKLIST_SETTINGS_KEY, value: JSON.stringify(next) })
      return next
    })
  }, [setSetting])

  const markSetupGuideCompleted = useCallback((): void => {
    updatePersistedState((previous) => ({
      ...previous,
      completed: {
        ...previous.completed,
        setupGuide: true
      }
    }))
  }, [updatePersistedState])

  const startTour = useCallback((): void => {
    useDialogStore.getState().openAnimatedTour()
    updatePersistedState((previous) => ({
      ...previous,
      completed: {
        ...previous.completed,
        takeTour: true
      }
    }))
  }, [updatePersistedState])

  const checkLeaderboard = useCallback((): void => {
    onCheckLeaderboard()
    updatePersistedState((previous) => ({
      ...previous,
      completed: {
        ...previous.completed,
        checkLeaderboard: true
      }
    }))
  }, [onCheckLeaderboard, updatePersistedState])

  const joinCommunity = useCallback((): void => {
    onJoinCommunity()
    updatePersistedState((previous) => ({
      ...previous,
      completed: {
        ...previous.completed,
        joinCommunity: true
      }
    }))
  }, [onJoinCommunity, updatePersistedState])

  const followOnX = useCallback((): void => {
    onFollowOnX()
    updatePersistedState((previous) => ({
      ...previous,
      completed: {
        ...previous.completed,
        followOnX: true
      }
    }))
  }, [onFollowOnX, updatePersistedState])

  const dismissChecklist = useCallback((): void => {
    updatePersistedState(() => ({
      version: CHECKLIST_STATE_VERSION,
      dismissed: true,
      completed: {
        setupGuide: true,
        takeTour: true,
        checkLeaderboard: true,
        joinCommunity: true,
        followOnX: true
      }
    }))
  }, [updatePersistedState])

  const steps = useMemo<OnboardingChecklistStep[]>(() => {
    const forceComplete = persistedState.dismissed
    return [
      {
        id: 'setup-guide',
        label: 'Setup guide',
        completed: forceComplete || persistedState.completed.setupGuide,
        allowWhenCompleted: true,
        onClick: () => useDialogStore.getState().openOnboarding()
      },
      {
        id: 'take-tour',
        label: 'Take a tour',
        completed: forceComplete || persistedState.completed.takeTour,
        allowWhenCompleted: true,
        onClick: startTour
      },
      {
        id: 'create-first-project',
        label: 'Create first project',
        completed: forceComplete || projectCount > 0,
        onClick: () => useDialogStore.getState().openCreateProject()
      },
      {
        id: 'create-first-task',
        label: 'Create first task',
        completed: forceComplete || hasCreatedTask,
        disabled: !forceComplete && projectCount === 0,
        onClick: () => useDialogStore.getState().openCreateTask()
      },
      {
        id: 'check-leaderboard',
        label: 'Checkout the leaderboard',
        completed: forceComplete || persistedState.completed.checkLeaderboard,
        onClick: checkLeaderboard
      },
      {
        id: 'join-community',
        label: 'Join the community',
        completed: forceComplete || persistedState.completed.joinCommunity,
        onClick: joinCommunity
      },
      {
        id: 'follow-x',
        label: 'Follow updates on X',
        completed: forceComplete || persistedState.completed.followOnX,
        onClick: followOnX
      }
    ]
  }, [
    persistedState.dismissed,
    persistedState.completed.setupGuide,
    persistedState.completed.takeTour,
    persistedState.completed.checkLeaderboard,
    persistedState.completed.joinCommunity,
    persistedState.completed.followOnX,
    projectCount,
    hasCreatedTask,
    startTour,
    checkLeaderboard,
    joinCommunity,
    followOnX
  ])

  const remainingCount = useMemo(() => steps.reduce((count, step) => (step.completed ? count : count + 1), 0), [steps])

  const checklist = useMemo<OnboardingChecklistState>(() => ({
    steps,
    dismissed: persistedState.dismissed,
    remainingCount,
    hasRemaining: remainingCount > 0,
    onDismiss: dismissChecklist
  }), [steps, persistedState.dismissed, remainingCount, dismissChecklist])

  return {
    checklist,
    startTour,
    markSetupGuideCompleted
  }
}
