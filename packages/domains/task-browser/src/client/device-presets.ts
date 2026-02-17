import type { DeviceEmulation } from '../shared'

const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

const IPAD_UA =
  'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'

export const DEVICE_PRESETS: DeviceEmulation[] = [
  { name: 'iPhone SE', width: 375, height: 667, deviceScaleFactor: 2, mobile: true, userAgent: MOBILE_UA },
  { name: 'iPhone 15 Pro', width: 393, height: 852, deviceScaleFactor: 3, mobile: true, userAgent: MOBILE_UA },
  { name: 'iPhone 15 Pro Max', width: 430, height: 932, deviceScaleFactor: 3, mobile: true, userAgent: MOBILE_UA },
  { name: 'iPad Mini', width: 768, height: 1024, deviceScaleFactor: 2, mobile: true, userAgent: IPAD_UA },
  { name: 'iPad Pro 12.9"', width: 1024, height: 1366, deviceScaleFactor: 2, mobile: true, userAgent: IPAD_UA },
  { name: 'Pixel 7', width: 412, height: 915, deviceScaleFactor: 2.625, mobile: true, userAgent: ANDROID_UA },
  { name: 'Desktop 1080p', width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false },
  { name: 'Desktop 1440p', width: 2560, height: 1440, deviceScaleFactor: 1, mobile: false },
]
