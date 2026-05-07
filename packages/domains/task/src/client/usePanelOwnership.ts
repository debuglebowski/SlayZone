import { useCallback, useEffect, useState, useMemo } from 'react'
import { getTrpcVanillaClient } from '@slayzone/transport/client'

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
  const [windowId, setWindowId] = useState<number | null>(null)
  const [entries, setEntries] = useState<OwnershipEntry[]>([])
  const [releasedOnClose, setReleasedOnClose] = useState<Array<{ taskId: string; panelId: string }> | null>(null)

  // Resolve this window's id once via tRPC (server reads ?windowId from WS query)
  useEffect(() => {
    let alive = true
    getTrpcVanillaClient().app.taskWindows.getWindowId.query().then((id) => {
      if (alive) setWindowId(id as number | null)
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!taskId) {
      setEntries([])
      return
    }
    let alive = true
    getTrpcVanillaClient().app.taskWindows.getOwnership.query({ taskId }).then((list) => {
      if (alive) setEntries(list as OwnershipEntry[])
    })
    const sub = getTrpcVanillaClient().app.taskWindows.onOwnershipChanged.subscribe(undefined, {
      onData: (payload) => {
        if (payload.taskId === taskId) setEntries(payload.ownership)
      },
    })
    return () => {
      alive = false
      sub.unsubscribe()
    }
  }, [taskId])

  useEffect(() => {
    const sub = getTrpcVanillaClient().app.taskWindows.onPanelsReleasedOnClose.subscribe(undefined, {
      onData: (payload) => {
        if (!taskId) return
        const forThisTask = payload.released.filter((r) => r.taskId === taskId)
        if (forThisTask.length > 0) setReleasedOnClose(forThisTask)
      },
    })
    return () => sub.unsubscribe()
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
      return getTrpcVanillaClient().app.taskWindows.claimPanel.mutate({ taskId, panelId })
    },
    [taskId]
  )

  const claimAndCloseOther = useCallback(
    async (panelId: string) => {
      if (!taskId) return { ok: false }
      return getTrpcVanillaClient().app.taskWindows.claimAndCloseOther.mutate({ taskId, panelId })
    },
    [taskId]
  )

  const release = useCallback(
    async (panelId: string) => {
      if (!taskId) return { ok: false }
      return getTrpcVanillaClient().app.taskWindows.releasePanel.mutate({ taskId, panelId })
    },
    [taskId]
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
