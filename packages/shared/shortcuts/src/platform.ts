export type Platform = 'mac' | 'other'

let cached: Platform | null = null

export function detectPlatform(): Platform {
  if (cached) return cached
  if (typeof process !== 'undefined' && process.platform) {
    cached = process.platform === 'darwin' ? 'mac' : 'other'
  } else if (typeof navigator !== 'undefined' && navigator.userAgent) {
    cached = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent) ? 'mac' : 'other'
  } else {
    cached = 'other'
  }
  return cached
}
