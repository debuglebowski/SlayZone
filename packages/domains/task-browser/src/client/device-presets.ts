import type { DeviceEmulation, DeviceSlot, MultiDeviceConfig } from '../shared'

export const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

export const IPAD_UA =
  'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'

export const DEVICE_PRESETS: DeviceEmulation[] = [
  { name: 'Desktop 1080p', width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false, category: 'Desktop' },
  { name: 'Desktop 1440p', width: 2560, height: 1440, deviceScaleFactor: 1, mobile: false, category: 'Desktop' },
  { name: 'iPad Mini', width: 768, height: 1024, deviceScaleFactor: 2, mobile: true, userAgent: IPAD_UA, category: 'Tablet' },
  { name: 'iPad Pro 12.9"', width: 1024, height: 1366, deviceScaleFactor: 2, mobile: true, userAgent: IPAD_UA, category: 'Tablet' },
  { name: 'iPhone SE', width: 375, height: 667, deviceScaleFactor: 2, mobile: true, userAgent: MOBILE_UA, category: 'Mobile' },
  { name: 'iPhone 15 Pro', width: 393, height: 852, deviceScaleFactor: 3, mobile: true, userAgent: MOBILE_UA, category: 'Mobile' },
  { name: 'iPhone 15 Pro Max', width: 430, height: 932, deviceScaleFactor: 3, mobile: true, userAgent: MOBILE_UA, category: 'Mobile' },
  { name: 'Pixel 7', width: 412, height: 915, deviceScaleFactor: 2.625, mobile: true, userAgent: ANDROID_UA, category: 'Mobile' },
]

/** Default presets per device slot */
export function defaultMultiDeviceConfig(): MultiDeviceConfig {
  return {
    desktop: { enabled: true, preset: DEVICE_PRESETS.find(p => p.name === 'Desktop 1080p')! },
    tablet:  { enabled: true, preset: DEVICE_PRESETS.find(p => p.name === 'iPad Mini')! },
    mobile:  { enabled: true, preset: DEVICE_PRESETS.find(p => p.name === 'iPhone 15 Pro')! },
  }
}

/** All presets, with slot-relevant ones sorted first */
export function presetsForSlot(slot: DeviceSlot): DeviceEmulation[] {
  const isRelevant = (p: DeviceEmulation) => {
    if (slot === 'desktop') return !p.mobile
    if (slot === 'tablet') return p.mobile && p.width >= 700
    return p.mobile && p.width < 700
  }
  return [...DEVICE_PRESETS.filter(isRelevant), ...DEVICE_PRESETS.filter(p => !isRelevant(p))]
}
