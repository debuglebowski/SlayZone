// material-file-icons is ~500KB raw. Vite hoisted it into the main bundle
// because both SearchDialog (lazy) and file-editor (lazy) import @slayzone/icons,
// so it was treated as a shared dep. The explicit import() below forces its
// own chunk regardless of importer count. App.tsx idle-prefetches it so the
// first FileIcon render usually hits a warm chunk.

type MaterialIcons = typeof import('material-file-icons')

let inflight: Promise<MaterialIcons> | null = null
let loaded: MaterialIcons | null = null

export function getFileIconSvg(fileName: string): string | null {
  if (loaded) return loaded.getIcon(fileName).svg
  return null
}

export function loadFileIcons(): Promise<MaterialIcons> {
  if (loaded) return Promise.resolve(loaded)
  if (!inflight) {
    inflight = import('material-file-icons').then((mod) => {
      loaded = mod
      return mod
    })
  }
  return inflight
}

export function getFileIconSvgAsync(fileName: string): Promise<string> {
  return loadFileIcons().then((m) => m.getIcon(fileName).svg)
}
