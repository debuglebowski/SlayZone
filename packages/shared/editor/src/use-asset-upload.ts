import { useCallback, useRef } from 'react'

export interface AssetRef {
  id: string
  title: string
}

export interface UseAssetUploadReturn {
  uploadFiles: (files: File[]) => Promise<AssetRef[]>
  getFilePath: (assetId: string) => Promise<string | null>
}

function tsSlug(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function extFromMime(mime: string): string {
  if (!mime) return ''
  if (mime === 'image/jpeg') return '.jpg'
  if (mime === 'image/svg+xml') return '.svg'
  const m = mime.match(/^image\/([a-z0-9+\-.]+)$/i)
  return m ? `.${m[1]}` : ''
}

interface AssetsApiNarrow {
  uploadBlob: (data: { taskId: string; title: string; bytes: Uint8Array }) => Promise<AssetRef | null>
  getFilePath: (id: string) => Promise<string | null>
}

function getAssetsApi(): AssetsApiNarrow {
  return (window as unknown as { api: { assets: AssetsApiNarrow } }).api.assets
}

export function useAssetUpload(taskId: string | null | undefined): UseAssetUploadReturn {
  const taskIdRef = useRef(taskId)
  taskIdRef.current = taskId

  const uploadFiles = useCallback(async (files: File[]): Promise<AssetRef[]> => {
    const tid = taskIdRef.current
    if (!tid) return []
    const assets = getAssetsApi()
    const results = await Promise.all(
      files.map(async (file) => {
        const buf = await file.arrayBuffer()
        const bytes = new Uint8Array(buf)
        const baseTitle = file.name && file.name.length > 0
          ? file.name
          : `pasted-${tsSlug()}${extFromMime(file.type)}`
        return assets.uploadBlob({ taskId: tid, title: baseTitle, bytes })
      })
    )
    return results.filter((a): a is AssetRef => a !== null)
  }, [])

  const getFilePath = useCallback((assetId: string): Promise<string | null> => {
    return getAssetsApi().getFilePath(assetId)
  }, [])

  return { uploadFiles, getFilePath }
}
