/**
 * Shared main-world desktop handoff hardening script for webviews.
 * This is injected via executeJavaScript (main process) and also evaluated
 * from webview preload so both paths stay in sync.
 */
export const WEBVIEW_DESKTOP_HANDOFF_SCRIPT = `
(function() {
  // Skip hardening in popup windows (OAuth, payment flows). The session preload
  // runs in ALL frames of persist:browser-tabs — including popup BrowserWindows.
  // Faking chrome.runtime, patching navigator, etc. confuses OAuth providers.
  if (window.opener) return;
  if (window.__slzDesktopHandoffPatched) return;
  Object.defineProperty(window, '__slzDesktopHandoffPatched', {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false,
  });

  // --- Patch Permissions.query to not throw (Electron rejects, triggering bot detection) ---
  if (navigator.permissions && navigator.permissions.query) {
    var origQuery = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = function(desc) {
      return origQuery(desc).catch(function() {
        return { state: 'prompt', onchange: null };
      });
    };
  }

  // --- Hide webdriver flag (top bot-detection signal for CAPTCHAs) ---
  Object.defineProperty(navigator, 'webdriver', {
    get: function() { return false; },
    configurable: true,
    enumerable: true,
  });

  // --- Ensure languages is populated ---
  if (!navigator.languages || navigator.languages.length === 0) {
    Object.defineProperty(navigator, 'languages', {
      get: function() { return ['en-US', 'en']; },
      configurable: true,
      enumerable: true,
    });
  }

  // --- Spoof navigator.userAgentData (Client Hints JS API) ---
  // The Sec-CH-UA header is overridden at the network level, but Google's sign-in
  // also checks the JS API which still exposes Electron/non-Chrome brands.
  if (navigator.userAgentData) {
    var origUAData = navigator.userAgentData;
    var chromiumBrand = origUAData.brands.find(function(b) { return b.brand === 'Chromium'; });
    var cVer = chromiumBrand ? chromiumBrand.version : '142';
    var spoofedBrands = [
      { brand: 'Google Chrome', version: cVer },
      { brand: 'Chromium', version: cVer },
      { brand: 'Not_A Brand', version: '8' },
    ];
    var spoofedUAData = {
      brands: spoofedBrands,
      mobile: false,
      platform: origUAData.platform,
      toJSON: function() { return { brands: spoofedBrands, mobile: false, platform: origUAData.platform }; },
      getHighEntropyValues: function(hints) {
        return origUAData.getHighEntropyValues(hints).then(function(values) {
          values.brands = spoofedBrands;
          values.fullVersionList = [
            { brand: 'Google Chrome', version: cVer + '.0.0.0' },
            { brand: 'Chromium', version: cVer + '.0.0.0' },
            { brand: 'Not_A Brand', version: '8.0.0.0' },
          ];
          return values;
        });
      },
    };
    Object.defineProperty(navigator, 'userAgentData', {
      get: function() { return spoofedUAData; },
      configurable: true,
      enumerable: true,
    });
  }

  // --- Fake window.chrome properties so sites detect "real Chrome" ---
  if (!window.chrome) window.chrome = {};
  if (!window.chrome.app) {
    window.chrome.app = {
      isInstalled: false,
      InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
      RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
      getDetails: function() { return null; },
      getIsInstalled: function() { return false; },
      installState: function(cb) { if (cb) cb('not_installed'); },
      runningState: function() { return 'cannot_run'; },
    };
  }
  if (!window.chrome.runtime) {
    window.chrome.runtime = {
      OnInstalledReason: { CHROME_UPDATE: 'chrome_update', INSTALL: 'install', SHARED_MODULE_UPDATE: 'shared_module_update', UPDATE: 'update' },
      OnRestartRequiredReason: { APP_UPDATE: 'app_update', OS_UPDATE: 'os_update', PERIODIC: 'periodic' },
      PlatformArch: { ARM: 'arm', ARM64: 'arm64', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
      PlatformNaclArch: { ARM: 'arm', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
      PlatformOs: { ANDROID: 'android', CROS: 'cros', LINUX: 'linux', MAC: 'mac', OPENBSD: 'openbsd', WIN: 'win' },
      RequestUpdateCheckStatus: { NO_UPDATE: 'no_update', THROTTLED: 'throttled', UPDATE_AVAILABLE: 'update_available' },
      connect: function() { return { onMessage: { addListener: function() {} }, postMessage: function() {}, disconnect: function() {} }; },
      sendMessage: function() {},
    };
  }

  // --- Spoof navigator.plugins / mimeTypes (empty in Electron, PDF Viewer in real Chrome) ---
  if (!navigator.plugins || navigator.plugins.length === 0) {
    var pdfPlugin = { name: 'PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format', length: 1 };
    var pdfMime = { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format', enabledPlugin: pdfPlugin };
    pdfPlugin[0] = pdfMime;
    Object.defineProperty(navigator, 'plugins', {
      get: function() {
        var p = [pdfPlugin];
        p.item = function(i) { return this[i] || null; };
        p.namedItem = function(n) { return n === 'PDF Viewer' ? pdfPlugin : null; };
        p.refresh = function() {};
        return p;
      },
      configurable: true, enumerable: true,
    });
    Object.defineProperty(navigator, 'mimeTypes', {
      get: function() {
        var m = [pdfMime];
        m.item = function(i) { return this[i] || null; };
        m.namedItem = function(n) { return n === 'application/pdf' ? pdfMime : null; };
        return m;
      },
      configurable: true, enumerable: true,
    });
  }

  // --- Fake chrome.csi and chrome.loadTimes (Google checks these Chrome-only APIs) ---
  if (!window.chrome) window.chrome = {};
  if (!window.chrome.csi) {
    window.chrome.csi = function() {
      return { startE: Date.now(), onloadT: 0, pageT: performance.now(), tran: 15 };
    };
  }
  if (!window.chrome.loadTimes) {
    window.chrome.loadTimes = function() {
      return {
        commitLoadTime: Date.now() / 1000,
        connectionInfo: 'h2',
        finishDocumentLoadTime: 0, finishLoadTime: 0,
        firstPaintAfterLoadTime: 0, firstPaintTime: 0,
        navigationType: 'Other',
        npnNegotiatedProtocol: 'h2',
        requestTime: Date.now() / 1000 - 0.16,
        startLoadTime: Date.now() / 1000 - 0.16,
        wasAlternateProtocolAvailable: false,
        wasFetchedViaSpdy: true, wasNpnNegotiated: true,
      };
    };
  }

  // --- Block external protocol navigation ---
  var isExternal = function(url) {
    if (typeof url !== 'string') return false;
    return !url.startsWith('http://') && !url.startsWith('https://') &&
      !url.startsWith('//') && !url.startsWith('about:') && !url.startsWith('#') &&
      !url.startsWith('blob:') && !url.startsWith('data:') && url.includes('://');
  };
  var origOpen = window.open.bind(window);
  window.open = function(url, target, features) {
    if (isExternal(url instanceof URL ? url.href : url)) return null;
    return origOpen(url, target, features);
  };
  var origHref = Object.getOwnPropertyDescriptor(Location.prototype, 'href');
  if (origHref && origHref.set) {
    Object.defineProperty(Location.prototype, 'href', {
      get: origHref.get, set: function(url) { if (!isExternal(url)) origHref.set.call(this, url); },
      enumerable: origHref.enumerable, configurable: origHref.configurable
    });
  }
  var origAssign = Location.prototype.assign;
  Location.prototype.assign = function(url) { if (!isExternal(url)) origAssign.call(this, url); };
  var origReplace = Location.prototype.replace;
  Location.prototype.replace = function(url) { if (!isExternal(url)) origReplace.call(this, url); };
  var origSrc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'src');
  if (origSrc && origSrc.set) {
    Object.defineProperty(HTMLIFrameElement.prototype, 'src', {
      get: origSrc.get, set: function(url) { if (!isExternal(url)) origSrc.set.call(this, url); },
      enumerable: origSrc.enumerable, configurable: origSrc.configurable
    });
  }
  var origSetAttr = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function(name, value) {
    if (this instanceof HTMLIFrameElement && name === 'src' && isExternal(value)) return;
    origSetAttr.call(this, name, value);
  };
})();
`
