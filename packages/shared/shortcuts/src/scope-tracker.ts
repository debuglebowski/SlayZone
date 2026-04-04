import type { ShortcutScope } from './scope'

type ComponentScope = 'terminal' | 'editor' | 'browser'

export class ScopeTracker {
  private focusedComponentScope: ComponentScope | null = null
  private _taskActive = false
  private _browserPassthrough = new Map<string, boolean>()
  private _focusedBrowserPanelId: string | null = null
  private cleanup: (() => void) | null = null

  init(): void {
    if (this.cleanup) return // already initialized

    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null
      if (!target?.closest) return

      if (target.closest('.xterm-helper-textarea') || target.closest('.xterm')) {
        this.focusedComponentScope = 'terminal'
        this._focusedBrowserPanelId = null
      } else if (target.closest('[data-panel-id="editor"]')) {
        // Only match file editors (CodeMirror/Milkdown inside the editor panel),
        // not task description editors which are also contenteditable.
        this.focusedComponentScope = 'editor'
        this._focusedBrowserPanelId = null
      } else if (target.closest('[data-browser-panel]')) {
        this.focusedComponentScope = 'browser'
        this._focusedBrowserPanelId = target.closest('[data-browser-panel]')?.getAttribute('data-browser-panel') ?? null
      } else {
        this.focusedComponentScope = null
        this._focusedBrowserPanelId = null
      }
    }

    document.addEventListener('focusin', onFocusIn)
    this.cleanup = () => document.removeEventListener('focusin', onFocusIn)
  }

  destroy(): void {
    this.cleanup?.()
    this.cleanup = null
  }

  set taskActive(active: boolean) {
    this._taskActive = active
  }

  get taskActive(): boolean {
    return this._taskActive
  }

  /** Override component scope imperatively (for WebContentsView focus). */
  setComponentScope(scope: ComponentScope, browserPanelId?: string): void {
    this.focusedComponentScope = scope
    this._focusedBrowserPanelId = browserPanelId ?? null
  }

  setBrowserPassthrough(panelId: string, enabled: boolean): void {
    this._browserPassthrough.set(panelId, enabled)
  }

  /** True if the focused browser panel has keyboard passthrough enabled. */
  isBrowserPassthrough(): boolean {
    if (!this._focusedBrowserPanelId) return false
    return this._browserPassthrough.get(this._focusedBrowserPanelId) === true
  }

  getActiveScopes(): Set<ShortcutScope> {
    const scopes = new Set<ShortcutScope>(['global'] as ShortcutScope[])
    if (this._taskActive) scopes.add('task')
    if (this.focusedComponentScope) scopes.add(this.focusedComponentScope)
    return scopes
  }

  /** Get the currently focused component scope (for testing/debugging). */
  get currentComponentScope(): ComponentScope | null {
    return this.focusedComponentScope
  }

  /** Get the currently focused browser panel ID (for testing/debugging). */
  get focusedBrowserPanelId(): string | null {
    return this._focusedBrowserPanelId
  }
}

export const scopeTracker = new ScopeTracker()
