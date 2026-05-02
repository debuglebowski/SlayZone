import { useCallback, useEffect, useState, useMemo } from 'react'

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

  // Resolve this window's webContents id once
  useEffect(() => {
    let alive = true
    window.api.panels.getWindowId().then((id) => {
      if (alive) setWindowId(id)
    })
    return () => {
      alive = false
    }
  }, [])

  // Refresh ownership snapshot + subscribe to live changes
  useEffect(() => {
    if (!taskId) {
      setEntries([])
      return
    }
    let alive = true
    window.api.panels.getOwnership(taskId).then((list) => {
      if (alive) setEntries(list)
    })
    const unsub = window.api.panels.onOwnershipChanged((payload) => {
      if (payload.taskId === taskId) setEntries(payload.ownership)
    })
    return () => {
      alive = false
      unsub()
    }
  }, [taskId])

  // Listen for window-close releases so the owning window's renderer can react
  useEffect(() => {
    return window.api.panels.onReleasedOnClose((payload) => {
      if (!taskId) return
      const forThisTask = payload.released.filter((r) => r.taskId === taskId)
      if (forThisTask.length > 0) setReleasedOnClose(forThisTask)
    })
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
      return window.api.panels.claim(taskId, panelId)
    },
    [taskId]
  )

  const claimAndCloseOther = useCallback(
    async (panelId: string) => {
      if (!taskId) return { ok: false }
      return window.api.panels.claimAndCloseOther(taskId, panelId)
    },
    [taskId]
  )

  const release = useCallback(
    async (panelId: string) => {
      if (!taskId) return { ok: false }
      return window.api.panels.release(taskId, panelId)
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
