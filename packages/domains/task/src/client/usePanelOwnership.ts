import { useCallback, useEffect, useState, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSubscription } from '@trpc/tanstack-react-query'
import { useTRPC } from '@slayzone/transport/client'

interface OwnershipEntry {
  panelId: string
  ownerWindowId: number
}

/**
 * Subscribes to panel ownership for a given task. Each panel can be "owned" by
 * one window at a time. The owning window renders the panel; other windows
 * show a stub.
 */
export function usePanelOwnership(taskId: string | undefined) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [releasedOnClose, setReleasedOnClose] = useState<Array<{ taskId: string; panelId: string }> | null>(null)

  const windowIdQuery = useQuery(trpc.app.taskWindows.getWindowId.queryOptions())
  const windowId = (windowIdQuery.data ?? null) as number | null

  const ownershipQuery = useQuery({
    ...trpc.app.taskWindows.getOwnership.queryOptions({ taskId: taskId ?? '' }),
    enabled: !!taskId,
  })
  const entries = (ownershipQuery.data ?? []) as OwnershipEntry[]

  useSubscription(
    trpc.app.taskWindows.onOwnershipChanged.subscriptionOptions(undefined, {
      enabled: !!taskId,
      onData: (payload) => {
        if (payload.taskId !== taskId || !taskId) return
        queryClient.setQueryData(
          trpc.app.taskWindows.getOwnership.queryKey({ taskId }),
          payload.ownership,
        )
      },
    }),
  )

  useSubscription(
    trpc.app.taskWindows.onPanelsReleasedOnClose.subscriptionOptions(undefined, {
      enabled: !!taskId,
      onData: (payload) => {
        if (!taskId) return
        const forThisTask = payload.released.filter((r) => r.taskId === taskId)
        if (forThisTask.length > 0) setReleasedOnClose(forThisTask)
      },
    }),
  )

  const claimMutation = useMutation(trpc.app.taskWindows.claimPanel.mutationOptions())
  const claimAndCloseMutation = useMutation(trpc.app.taskWindows.claimAndCloseOther.mutationOptions())
  const releaseMutation = useMutation(trpc.app.taskWindows.releasePanel.mutationOptions())

  // Reset releasedOnClose when task changes
  useEffect(() => {
    setReleasedOnClose(null)
  }, [taskId])

  const ownerOf = useCallback(
    (panelId: string): number | null => entries.find((e) => e.panelId === panelId)?.ownerWindowId ?? null,
    [entries]
  )

  const isOwnedByMe = useCallback(
    (panelId: string): boolean => {
      if (windowId == null) return false
      return ownerOf(panelId) === windowId
    },
    [windowId, ownerOf]
  )

  const hasOtherOwner = useCallback(
    (panelId: string): boolean => {
      const owner = ownerOf(panelId)
      return owner !== null && owner !== windowId
    },
    [windowId, ownerOf]
  )

  const claim = useCallback(
    async (panelId: string) => {
      if (!taskId) return { ok: false }
      return claimMutation.mutateAsync({ taskId, panelId })
    },
    [taskId, claimMutation]
  )

  const claimAndCloseOther = useCallback(
    async (panelId: string) => {
      if (!taskId) return { ok: false }
      return claimAndCloseMutation.mutateAsync({ taskId, panelId })
    },
    [taskId, claimAndCloseMutation]
  )

  const release = useCallback(
    async (panelId: string) => {
      if (!taskId) return { ok: false }
      return releaseMutation.mutateAsync({ taskId, panelId })
    },
    [taskId, releaseMutation]
  )

  const consumeReleasedOnClose = useCallback(() => {
    setReleasedOnClose(null)
  }, [])

  return useMemo(
    () => ({
      windowId,
      ownerOf,
      isOwnedByMe,
      hasOtherOwner,
      claim,
      claimAndCloseOther,
      release,
      releasedOnClose,
      consumeReleasedOnClose
    }),
    [windowId, ownerOf, isOwnedByMe, hasOtherOwner, claim, claimAndCloseOther, release, releasedOnClose, consumeReleasedOnClose]
  )
}
