import { useState, useEffect, useCallback, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSubscription } from '@trpc/tanstack-react-query'
import { useTRPC, useTRPCClient } from '@slayzone/transport/client'
import type { TaskArtifact, RenderMode, CreateArtifactInput, UpdateArtifactInput, ArtifactFolder, UpdateArtifactFolderInput } from '@slayzone/task/shared'
import type { ArtifactVersion, VersionRef, DiffResult, PruneReport } from '@slayzone/task-artifacts/shared'
import { track } from '@slayzone/telemetry/client'

export interface UseArtifactsReturn {
  artifacts: TaskArtifact[]
  folders: ArtifactFolder[]
  isLoading: boolean
  selectedId: string | null
  setSelectedId: (id: string | null) => void
  // Artifact ops
  createArtifact: (params: { title: string; folderId?: string | null; renderMode?: RenderMode; content?: string; language?: string | null }) => Promise<TaskArtifact | null>
  updateArtifact: (data: UpdateArtifactInput) => Promise<void>
  deleteArtifact: (id: string) => Promise<void>
  renameArtifact: (id: string, newTitle: string) => Promise<void>
  moveArtifactToFolder: (artifactId: string, folderId: string | null) => Promise<void>
  readContent: (id: string) => Promise<string | null>
  saveContent: (id: string, content: string) => Promise<void>
  uploadArtifact: (sourcePath: string, title?: string) => Promise<TaskArtifact | null>
  uploadDir: (dirPath: string, parentFolderId?: string | null) => Promise<void>
  getFilePath: (id: string) => Promise<string | null>
  downloadFile: (id: string) => Promise<boolean>
  downloadFolder: (id: string) => Promise<boolean>
  downloadAsPdf: (id: string) => Promise<boolean>
  downloadAsPng: (id: string) => Promise<boolean>
  downloadAsHtml: (id: string) => Promise<boolean>
  downloadAllAsZip: () => Promise<boolean>
  // Versions
  listVersions: (artifactId: string, opts?: { limit?: number; offset?: number }) => Promise<ArtifactVersion[]>
  readVersion: (artifactId: string, versionRef: VersionRef) => Promise<string>
  createVersion: (artifactId: string, name?: string | null) => Promise<ArtifactVersion>
  renameVersion: (artifactId: string, versionRef: VersionRef, newName: string | null) => Promise<ArtifactVersion>
  diffVersions: (artifactId: string, a: VersionRef, b?: VersionRef) => Promise<DiffResult>
  pruneVersions: (artifactId: string, opts: { keepLast?: number; keepNamed?: boolean; keepCurrent?: boolean; dryRun?: boolean }) => Promise<PruneReport>
  setCurrentVersion: (artifactId: string, versionRef: VersionRef) => Promise<ArtifactVersion>
  // Folder ops
  createFolder: (params: { name: string; parentId?: string | null }) => Promise<ArtifactFolder | null>
  updateFolder: (data: UpdateArtifactFolderInput) => Promise<void>
  deleteFolder: (id: string) => Promise<void>
  renameFolder: (id: string, newName: string) => Promise<void>
  // Path helpers
  getArtifactPath: (artifact: TaskArtifact) => string
  pathToFolderId: Map<string, string>
  folderPathMap: Map<string, string>
}

export function useArtifacts(taskId: string | null | undefined, initialSelectedId?: string | null): UseArtifactsReturn {
  const trpc = useTRPC()
  const trpcClient = useTRPCClient()
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId ?? null)

  // Re-sync selection when switching tasks
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setSelectedId(initialSelectedId ?? null) }, [taskId])

  const artifactsQuery = useQuery({
    ...trpc.task.artifactsGetByTask.queryOptions({ taskId: taskId ?? '' }),
    enabled: !!taskId,
  })
  const foldersQuery = useQuery({
    ...trpc.task.foldersGetByTask.queryOptions({ taskId: taskId ?? '' }),
    enabled: !!taskId,
  })

  const artifacts = artifactsQuery.data ?? []
  const folders = foldersQuery.data ?? []
  const isLoading = !!taskId && (artifactsQuery.isLoading || foldersQuery.isLoading)

  const invalidateArtifacts = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: trpc.task.artifactsGetByTask.queryKey() })
  }, [queryClient, trpc])
  const invalidateFolders = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: trpc.task.foldersGetByTask.queryKey() })
  }, [queryClient, trpc])
  const invalidateAll = useCallback(() => {
    invalidateArtifacts()
    invalidateFolders()
  }, [invalidateArtifacts, invalidateFolders])

  useSubscription(
    trpc.task.onChanged.subscriptionOptions(undefined, {
      enabled: !!taskId,
      onData: () => {
        if (!taskId) return
        invalidateAll()
      },
    }),
  )

  // Build folder path lookup: folderId -> slash-separated path
  const folderPathMap = useMemo(() => {
    const map = new Map<string, string>()
    const byId = new Map(folders.map(f => [f.id, f]))
    function resolve(id: string): string {
      if (map.has(id)) return map.get(id)!
      const f = byId.get(id)
      if (!f) return ''
      const path = f.parent_id ? `${resolve(f.parent_id)}/${f.name}` : f.name
      map.set(id, path)
      return path
    }
    for (const f of folders) resolve(f.id)
    return map
  }, [folders])

  const pathToFolderId = useMemo(() => {
    const map = new Map<string, string>()
    for (const [id, path] of folderPathMap) map.set(path, id)
    return map
  }, [folderPathMap])

  const getArtifactPath = useCallback((artifact: TaskArtifact): string => {
    if (!artifact.folder_id) return artifact.title
    const folderPath = folderPathMap.get(artifact.folder_id)
    return folderPath ? `${folderPath}/${artifact.title}` : artifact.title
  }, [folderPathMap])

  // --- Artifact CRUD ---

  const createMutation = useMutation(trpc.task.artifactsCreate.mutationOptions({
    onSuccess: (artifact) => {
      invalidateArtifacts()
      if (artifact) {
        setSelectedId(artifact.id)
        track('asset_created')
      }
    },
  }))
  const updateMutation = useMutation(trpc.task.artifactsUpdate.mutationOptions({
    onSuccess: () => invalidateArtifacts(),
  }))
  const deleteMutation = useMutation(trpc.task.artifactsDelete.mutationOptions({
    onSuccess: (_data, vars) => {
      invalidateArtifacts()
      setSelectedId(prev => prev === vars.id ? null : prev)
      track('asset_deleted')
    },
  }))
  const uploadMutation = useMutation(trpc.task.artifactsUpload.mutationOptions({
    onSuccess: (artifact) => {
      invalidateArtifacts()
      if (artifact) {
        setSelectedId(artifact.id)
        track('asset_created')
      }
    },
  }))
  const uploadDirMutation = useMutation(trpc.task.artifactsUploadDir.mutationOptions({
    onSuccess: invalidateAll,
  }))
  const versionsSetCurrentMutation = useMutation(trpc.task.versionsSetCurrent.mutationOptions({
    onSuccess: invalidateArtifacts,
  }))
  const createFolderMutation = useMutation(trpc.task.foldersCreate.mutationOptions({
    onSuccess: invalidateFolders,
  }))
  const updateFolderMutation = useMutation(trpc.task.foldersUpdate.mutationOptions({
    onSuccess: invalidateFolders,
  }))
  const deleteFolderMutation = useMutation(trpc.task.foldersDelete.mutationOptions({
    onSuccess: invalidateAll,
  }))

  const createArtifact = useCallback(async (params: { title: string; folderId?: string | null; renderMode?: RenderMode; content?: string; language?: string | null }): Promise<TaskArtifact | null> => {
    if (!taskId) return null
    const data: CreateArtifactInput = { taskId, ...params }
    return await createMutation.mutateAsync(data)
  }, [taskId, createMutation])

  const updateArtifact = useCallback(async (data: UpdateArtifactInput): Promise<void> => {
    await updateMutation.mutateAsync(data)
  }, [updateMutation])

  const deleteArtifact = useCallback(async (id: string): Promise<void> => {
    await deleteMutation.mutateAsync({ id })
  }, [deleteMutation])

  const renameArtifact = useCallback(async (id: string, newTitle: string): Promise<void> => {
    await updateMutation.mutateAsync({ id, title: newTitle })
  }, [updateMutation])

  const moveArtifactToFolder = useCallback(async (artifactId: string, folderId: string | null): Promise<void> => {
    await updateMutation.mutateAsync({ id: artifactId, folderId })
  }, [updateMutation])

  const readContent = useCallback(async (id: string): Promise<string | null> => {
    return trpcClient.task.artifactsReadContent.query({ id })
  }, [trpcClient])

  const saveContent = useCallback(async (id: string, content: string): Promise<void> => {
    // UI saves always mutate the latest version in place. The explicit
    // "Create version" action is the only UI path that creates new versions.
    await updateMutation.mutateAsync({ id, content, mutateVersion: true })
  }, [updateMutation])

  const uploadArtifact = useCallback(async (sourcePath: string, title?: string): Promise<TaskArtifact | null> => {
    if (!taskId) return null
    return await uploadMutation.mutateAsync({ taskId, sourcePath, title })
  }, [taskId, uploadMutation])

  const getFilePath = useCallback(async (id: string): Promise<string | null> => {
    return trpcClient.task.artifactsGetFilePath.query({ id })
  }, [trpcClient])

  const downloadFile = useCallback(async (id: string): Promise<boolean> => {
    return trpcClient.task.artifactsDownloadFile.mutate({ id })
  }, [trpcClient])

  const downloadFolder = useCallback(async (id: string): Promise<boolean> => {
    return trpcClient.task.artifactsDownloadFolder.mutate({ folderId: id })
  }, [trpcClient])

  const downloadAsPdf = useCallback(async (id: string): Promise<boolean> => {
    return trpcClient.task.artifactsDownloadAsPdf.mutate({ id })
  }, [trpcClient])

  const downloadAsPng = useCallback(async (id: string): Promise<boolean> => {
    return trpcClient.task.artifactsDownloadAsPng.mutate({ id })
  }, [trpcClient])

  const downloadAsHtml = useCallback(async (id: string): Promise<boolean> => {
    return trpcClient.task.artifactsDownloadAsHtml.mutate({ id })
  }, [trpcClient])

  const downloadAllAsZip = useCallback(async (): Promise<boolean> => {
    if (!taskId) return false
    return trpcClient.task.artifactsDownloadAllAsZip.mutate({ taskId })
  }, [taskId, trpcClient])

  const uploadDir = useCallback(async (dirPath: string, parentFolderId?: string | null): Promise<void> => {
    if (!taskId) return
    await uploadDirMutation.mutateAsync({ taskId, dirPath, parentFolderId: parentFolderId ?? null })
  }, [taskId, uploadDirMutation])

  // --- Versions ---

  const listVersions = useCallback(async (artifactId: string, opts?: { limit?: number; offset?: number }): Promise<ArtifactVersion[]> => {
    return trpcClient.task.versionsList.query({ artifactId, ...opts })
  }, [trpcClient])

  const readVersion = useCallback(async (artifactId: string, versionRef: VersionRef): Promise<string> => {
    return trpcClient.task.versionsRead.query({ artifactId, versionRef })
  }, [trpcClient])

  const createVersion = useCallback(async (artifactId: string, name?: string | null): Promise<ArtifactVersion> => {
    return trpcClient.task.versionsCreate.mutate({ artifactId, name })
  }, [trpcClient])

  const renameVersion = useCallback(async (artifactId: string, versionRef: VersionRef, newName: string | null): Promise<ArtifactVersion> => {
    return trpcClient.task.versionsRename.mutate({ artifactId, versionRef, newName })
  }, [trpcClient])

  const diffVersions = useCallback(async (artifactId: string, a: VersionRef, b?: VersionRef): Promise<DiffResult> => {
    return trpcClient.task.versionsDiff.query({ artifactId, a, b })
  }, [trpcClient])

  const pruneVersions = useCallback(async (artifactId: string, opts: { keepLast?: number; keepNamed?: boolean; keepCurrent?: boolean; dryRun?: boolean }): Promise<PruneReport> => {
    return trpcClient.task.versionsPrune.mutate({ artifactId, ...opts })
  }, [trpcClient])

  const setCurrentVersion = useCallback(async (artifactId: string, versionRef: VersionRef): Promise<ArtifactVersion> => {
    return await versionsSetCurrentMutation.mutateAsync({ artifactId, versionRef })
  }, [versionsSetCurrentMutation])

  // --- Folder CRUD ---

  const createFolder = useCallback(async (params: { name: string; parentId?: string | null }): Promise<ArtifactFolder | null> => {
    if (!taskId) return null
    return await createFolderMutation.mutateAsync({ taskId, ...params })
  }, [taskId, createFolderMutation])

  const updateFolder = useCallback(async (data: UpdateArtifactFolderInput): Promise<void> => {
    await updateFolderMutation.mutateAsync(data)
  }, [updateFolderMutation])

  const deleteFolder = useCallback(async (id: string): Promise<void> => {
    await deleteFolderMutation.mutateAsync({ id })
  }, [deleteFolderMutation])

  const renameFolder = useCallback(async (id: string, newName: string): Promise<void> => {
    await updateFolderMutation.mutateAsync({ id, name: newName })
  }, [updateFolderMutation])

  return {
    artifacts, folders, isLoading, selectedId, setSelectedId,
    createArtifact, updateArtifact, deleteArtifact, renameArtifact, moveArtifactToFolder,
    readContent, saveContent, uploadArtifact, uploadDir, getFilePath,
    downloadFile, downloadFolder, downloadAsPdf, downloadAsPng, downloadAsHtml, downloadAllAsZip,
    listVersions, readVersion, createVersion, renameVersion, diffVersions, pruneVersions, setCurrentVersion,
    createFolder, updateFolder, deleteFolder, renameFolder,
    getArtifactPath, pathToFolderId, folderPathMap,
  }
}
