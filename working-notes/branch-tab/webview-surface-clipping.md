# Webview surface clipping under CSS transform — RESOLVED

## The problem

When a `<webview>` under `transform: scale()` uses `enableDeviceEmulation` with explicit `viewSize`, a white strip appears — content doesn't fill the element.

## Root cause

Known Chromium bug ([crbug.com/492182](https://issues.chromium.org/issues/41177314)).

`enableDeviceEmulation` overrides viewport at the Blink renderer level via `ScreenMetricsEmulator`. But the compositor surface is allocated by the browser process from the embedder layout. Under CSS `transform: scale()`, the surface may be allocated at the post-transform size. When emulation says "viewport=1920px" but the surface is ~826px, the content is clipped.

## Solution

**Don't override `viewSize`.** Pass `viewSize: {width: 0, height: 0}` to `enableDeviceEmulation` (`{0,0}` = "no override" per Electron docs). The viewport comes naturally from the webview element's CSS layout size (e.g., 1920x1080), which the CSS transform then scales visually. Use emulation for DPR, screen dimensions, mobile flag, and user agent only.

```tsx
window.api.webview?.enableDeviceEmulation(wcId, {
  screenSize: { width: preset.width, height: preset.height },
  viewSize: { width: 0, height: 0 }, // no viewport override — use CSS layout size
  deviceScaleFactor: preset.deviceScaleFactor,
  screenPosition: preset.mobile ? 'mobile' : 'desktop',
  userAgent: preset.userAgent,
})
```

**Verified:** `window.innerWidth` = 1920 on Desktop 1080p (DPR 1) on Retina host. All three device presets render at correct resolutions with no clipping.

## Why this works

- The webview element is sized to `preset.width × preset.height` (e.g., 1920×1080) inside the viewport div
- CSS `transform: scale(widthScale)` on the viewport div scales it visually to fit the container
- With `viewSize: {0,0}`, emulation doesn't override the viewport — the page sees the CSS layout size
- DPR, screen dimensions, mobile flag, and user agent are renderer-side overrides that don't conflict with surface allocation
- No surface/viewport mismatch = no clipping
