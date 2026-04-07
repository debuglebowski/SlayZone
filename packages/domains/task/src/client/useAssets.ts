import { useState, useEffect, useCallback } from 'react'
import type { DragEndEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import type { TaskAsset, RenderMode, CreateAssetInput, UpdateAssetInput } from '@slayzone/task/shared'
import { track } from '@slayzone/telemetry/client'

export interface UseAssetsReturn {
  assets: TaskAsset[]
  selectedId: string | null
  setSelectedId: (id: string | null) => void
  createAsset: (params: { title: string; renderMode?: RenderMode; content?: string; language?: string | null }) => Promise<TaskAsset | null>
  updateAsset: (data: UpdateAssetInput) => Promise<void>
  deleteAsset: (id: string) => Promise<void>
  readContent: (id: string) => Promise<string | null>
  saveContent: (id: string, content: string) => Promise<void>
  uploadAsset: (sourcePath: string, title?: string) => Promise<TaskAsset | null>
  getFilePath: (id: string) => Promise<string | null>
  handleDragEnd: (event: DragEndEvent) => void
}

export function useAssets(taskId: string | null | undefined): UseAssetsReturn {
  const [assets, setAssets] = useState<TaskAsset[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Fetch assets on mount and external changes
  useEffect(() => {
    if (!taskId) return
    const load = (): void => {
      window.api.assets.getByTask(taskId).then(setAssets).catch(() => {})
    }
    load()
    const cleanup = window.api?.app?.onTasksChanged?.(load)
    return () => { cleanup?.() }
  }, [taskId])

  const createAsset = useCallback(async (params: { title: string; renderMode?: RenderMode; content?: string; language?: string | null }): Promise<TaskAsset | null> => {
    if (!taskId) return null
    const data: CreateAssetInput = { taskId, ...params }
    const asset = await window.api.assets.create(data)
    if (asset) {
      setAssets(prev => [...prev, asset])
      setSelectedId(asset.id)
      track('asset_created')
    }
    return asset
  }, [taskId])

  const updateAsset = useCallback(async (data: UpdateAssetInput): Promise<void> => {
    const updated = await window.api.assets.update(data)
    if (updated) {
      setAssets(prev => prev.map(a => a.id === data.id ? updated : a))
    }
  }, [])

  const deleteAsset = useCallback(async (id: string): Promise<void> => {
    await window.api.assets.delete(id)
    setAssets(prev => prev.filter(a => a.id !== id))
    setSelectedId(prev => prev === id ? null : prev)
    track('asset_deleted')
  }, [])

  const readContent = useCallback(async (id: string): Promise<string | null> => {
    return window.api.assets.readContent(id)
  }, [])

  const saveContent = useCallback(async (id: string, content: string): Promise<void> => {
    await window.api.assets.update({ id, content })
  }, [])

  const uploadAsset = useCallback(async (sourcePath: string, title?: string): Promise<TaskAsset | null> => {
    if (!taskId) return null
    const asset = await window.api.assets.upload({ taskId, sourcePath, title })
    if (asset) {
      setAssets(prev => [...prev, asset])
      setSelectedId(asset.id)
      track('asset_created')
    }
    return asset
  }, [taskId])

  const getFilePath = useCallback(async (id: string): Promise<string | null> => {
    return window.api.assets.getFilePath(id)
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent): void => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setAssets(prev => {
      const oldIndex = prev.findIndex(a => a.id === active.id)
      const newIndex = prev.findIndex(a => a.id === over.id)
      const reordered = arrayMove(prev, oldIndex, newIndex)
      window.api.assets.reorder(reordered.map(a => a.id))
      return reordered
    })
  }, [])

  return { assets, selectedId, setSelectedId, createAsset, updateAsset, deleteAsset, readContent, saveContent, uploadAsset, getFilePath, handleDragEnd }
}
