import { WEBVIEW_DESKTOP_HANDOFF_SCRIPT } from '../shared/webview-desktop-handoff-script'

// Evaluate the same hardening script used by main-process executeJavaScript injection
// so preload and runtime hardening stay behaviorally identical.
window.eval(WEBVIEW_DESKTOP_HANDOFF_SCRIPT)
